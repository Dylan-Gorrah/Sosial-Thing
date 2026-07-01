-- ── Post moderation columns ──────────────────────────────────────────────────
alter table public.posts
  add column removed_at     timestamptz,
  add column removed_reason text,
  add column removed_by     uuid references public.profiles(id) on delete set null;

-- ── Room bans (block = evict + can't rejoin) ────────────────────────────────
create table public.room_bans (
  id         uuid primary key default uuid_generate_v4(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  banned_by  uuid not null references public.profiles(id) on delete cascade,
  reason     text,
  created_at timestamptz not null default now(),
  unique (room_id, user_id)
);

alter table public.room_bans enable row level security;

-- ── Helper: is the caller the creator/owner of this room? ──────────────────
create or replace function public.is_room_owner(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rooms
    where id = p_room_id and created_by = auth.uid()
  );
$$;

grant execute on function public.is_room_owner(uuid) to authenticated;

-- ── room_bans policies ───────────────────────────────────────────────────────
create policy room_bans_select on public.room_bans
  for select using (user_id = auth.uid() or public.is_room_owner(room_id));

create policy room_bans_insert on public.room_bans
  for insert with check (public.is_room_owner(room_id) and banned_by = auth.uid());

create policy room_bans_delete on public.room_bans
  for delete using (public.is_room_owner(room_id));

-- ── room_members: owners can evict members (delete other people's rows) ────
create policy room_members_owner_evict on public.room_members
  for delete using (public.is_room_owner(room_id));

-- ── room_members: fix an overly-broad legacy INSERT policy ─────────────────
-- room_members_insert only checked auth.role() = 'authenticated', which let
-- any signed-in user insert a membership row for ANY user_id/room_id/role
-- (including 'owner') — a privilege-escalation hole. Replacing it with the
-- stricter join policy, now also blocking banned users from rejoining.
drop policy if exists room_members_insert on public.room_members;
drop policy if exists room_members_join   on public.room_members;

create policy room_members_join on public.room_members
  for insert with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.room_bans b
      where b.room_id = room_members.room_id and b.user_id = auth.uid()
    )
  );

-- ── Moderation RPCs (SECURITY DEFINER, self-contained authorization) ───────
-- Using RPCs instead of a broad posts UPDATE policy so a room owner can only
-- ever touch the removed_* columns, never rewrite someone else's post body.
create or replace function public.remove_post(p_post_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
begin
  select room_id into v_room_id from public.posts where id = p_post_id;

  if v_room_id is null or not public.is_room_owner(v_room_id) then
    raise exception 'Not authorized to remove this post';
  end if;

  update public.posts
  set removed_at = now(), removed_reason = p_reason, removed_by = auth.uid()
  where id = p_post_id;
end;
$$;

grant execute on function public.remove_post(uuid, text) to authenticated;

create or replace function public.evict_member(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_owner(p_room_id) then
    raise exception 'Not authorized';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot evict yourself';
  end if;

  delete from public.room_members
  where room_id = p_room_id and user_id = p_user_id and role <> 'owner';
end;
$$;

grant execute on function public.evict_member(uuid, uuid) to authenticated;

create or replace function public.block_member(p_room_id uuid, p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_owner(p_room_id) then
    raise exception 'Not authorized';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot block yourself';
  end if;

  delete from public.room_members
  where room_id = p_room_id and user_id = p_user_id and role <> 'owner';

  insert into public.room_bans (room_id, user_id, banned_by, reason)
  values (p_room_id, p_user_id, auth.uid(), p_reason)
  on conflict (room_id, user_id)
  do update set reason = excluded.reason, banned_by = excluded.banned_by, created_at = now();
end;
$$;

grant execute on function public.block_member(uuid, uuid, text) to authenticated;

create or replace function public.unblock_member(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_owner(p_room_id) then
    raise exception 'Not authorized';
  end if;
  delete from public.room_bans where room_id = p_room_id and user_id = p_user_id;
end;
$$;

grant execute on function public.unblock_member(uuid, uuid) to authenticated;
