
-- Drop existing policies if they exist (idempotent re-run)
drop policy if exists "follows_public_read" on follows;
drop policy if exists "follows_insert_own"  on follows;
drop policy if exists "follows_delete_own"  on follows;

-- Follows table (no-op if already exists)
create table if not exists follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at   timestamptz default now(),
  constraint follows_unique unique (follower_id, following_id),
  constraint no_self_follow check  (follower_id != following_id)
);

alter table follows enable row level security;

create policy "follows_public_read"
  on follows for select using (true);

create policy "follows_insert_own"
  on follows for insert
  with check (auth.uid() = follower_id);

create policy "follows_delete_own"
  on follows for delete
  using (auth.uid() = follower_id);

-- Trigger function (replace keeps it idempotent)
create or replace function update_follow_counts()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update profiles set follower_count  = follower_count  + 1 where id = NEW.following_id;
    update profiles set following_count = following_count + 1 where id = NEW.follower_id;
  elsif TG_OP = 'DELETE' then
    update profiles set follower_count  = greatest(follower_count  - 1, 0) where id = OLD.following_id;
    update profiles set following_count = greatest(following_count - 1, 0) where id = OLD.follower_id;
  end if;
  return null;
end;
$$;

drop trigger if exists follows_count_trigger on follows;
create trigger follows_count_trigger
after insert or delete on follows
for each row execute function update_follow_counts();
