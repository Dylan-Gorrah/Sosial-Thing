-- Reports: users flag a post or a comment; the report routes to whoever can
-- act on it — the room owner when the content lives in a room, the site
-- admin when it doesn't. Filing and resolving both go through SECURITY
-- DEFINER RPCs, same pattern as the moderation functions (20260701191137).

-- ── Site admin flag ───────────────────────────────────────────────────────────
-- Roomless content has no owner to route to, so reports on it go to the site
-- admin. Flip it on manually once:  update profiles set is_admin = true where username = '<you>';
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_site_admin() to authenticated;

-- ── reports table ─────────────────────────────────────────────────────────────
create table public.reports (
  id          uuid primary key default uuid_generate_v4(),
  -- exactly one of post_id / comment_id is set (enforced below)
  post_id     uuid references public.posts(id)    on delete cascade,
  comment_id  uuid references public.comments(id) on delete cascade,
  -- routing target, denormalized at filing time: null = goes to site admin
  room_id     uuid references public.rooms(id)    on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason      text not null check (reason in ('spam','abuse','stolen_work','other')),
  note        text check (char_length(note) <= 500),
  status      text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  check ((post_id is null) <> (comment_id is null))
);

create index reports_room_status_idx on public.reports(room_id, status);
create index reports_reporter_idx    on public.reports(reporter_id);

-- One OPEN report per person per target — re-reporting the same thing no-ops
create unique index reports_one_open_per_post
  on public.reports(reporter_id, post_id)    where status = 'open' and post_id    is not null;
create unique index reports_one_open_per_comment
  on public.reports(reporter_id, comment_id) where status = 'open' and comment_id is not null;

alter table public.reports enable row level security;

-- Reporters see their own; room owners see their room's; site admin sees all.
-- No insert/update policies on purpose — writes only happen via the RPCs.
create policy reports_select on public.reports
  for select using (
    reporter_id = auth.uid()
    or public.is_site_admin()
    or (room_id is not null and public.is_room_owner(room_id))
  );

-- ── file_report ───────────────────────────────────────────────────────────────
-- Figures out the routing itself (comment → post → room), dedupes against an
-- existing open report, and notifies the room owner (or the site admins).
-- The notification deliberately has no actor_id — reporters stay anonymous in
-- the inbox; the mod queue itself shows who reported for accountability.
create or replace function public.file_report(
  p_post_id    uuid default null,
  p_comment_id uuid default null,
  p_reason     text default null,
  p_note       text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_id   uuid;
  v_room_id   uuid;
  v_report_id uuid;
  v_owner     uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_reason is null or p_reason not in ('spam','abuse','stolen_work','other') then
    raise exception 'Pick a reason';
  end if;
  if (p_post_id is null) = (p_comment_id is null) then
    raise exception 'Report exactly one post or comment';
  end if;

  -- Resolve the target down to its post, then the post to its room
  if p_comment_id is not null then
    select post_id into v_post_id from public.comments where id = p_comment_id;
    if v_post_id is null then raise exception 'Comment not found'; end if;
  else
    v_post_id := p_post_id;
  end if;

  select room_id into v_room_id from public.posts where id = v_post_id;
  if not found then raise exception 'Post not found'; end if;

  -- Already an open report from this user on this target? Return it, done.
  select id into v_report_id from public.reports
  where reporter_id = auth.uid()
    and status = 'open'
    and (   (p_post_id    is not null and post_id    = p_post_id)
         or (p_comment_id is not null and comment_id = p_comment_id));
  if v_report_id is not null then
    return v_report_id;
  end if;

  insert into public.reports (post_id, comment_id, room_id, reporter_id, reason, note)
  values (p_post_id, p_comment_id, v_room_id, auth.uid(), p_reason, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_report_id;

  -- Notify whoever can act on it (never the reporter themselves)
  if v_room_id is not null then
    select created_by into v_owner from public.rooms where id = v_room_id;
    if v_owner is not null and v_owner <> auth.uid() then
      insert into public.notifications (user_id, type, post_id)
      values (v_owner, 'report_filed', v_post_id);
    end if;
  else
    insert into public.notifications (user_id, type, post_id)
    select id, 'report_filed', v_post_id
    from public.profiles
    where is_admin and id <> auth.uid();
  end if;

  return v_report_id;
end;
$$;

grant execute on function public.file_report(uuid, uuid, text, text) to authenticated;

-- ── resolve_report ────────────────────────────────────────────────────────────
create or replace function public.resolve_report(p_report_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_status  text;
begin
  if p_action not in ('resolved','dismissed') then
    raise exception 'Action must be resolved or dismissed';
  end if;

  select room_id, status into v_room_id, v_status
  from public.reports where id = p_report_id;
  if not found then raise exception 'Report not found'; end if;
  if v_status <> 'open' then return; end if;  -- already handled — no-op

  if not (public.is_site_admin() or (v_room_id is not null and public.is_room_owner(v_room_id))) then
    raise exception 'Not authorized to resolve this report';
  end if;

  update public.reports
  set status = p_action, resolved_by = auth.uid(), resolved_at = now()
  where id = p_report_id;
end;
$$;

grant execute on function public.resolve_report(uuid, text) to authenticated;

-- ── remove_post: let the site admin act on roomless posts too ────────────────
-- The original only allowed room owners, which left global-feed posts
-- unremovable by anyone. Same guarantees otherwise: only the removed_*
-- columns are ever touched.
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
  if not found then
    raise exception 'Post not found';
  end if;

  if not (public.is_site_admin() or (v_room_id is not null and public.is_room_owner(v_room_id))) then
    raise exception 'Not authorized to remove this post';
  end if;

  update public.posts
  set removed_at = now(), removed_reason = p_reason, removed_by = auth.uid()
  where id = p_post_id;
end;
$$;

grant execute on function public.remove_post(uuid, text) to authenticated;
