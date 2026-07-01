
create table if not exists bookmarks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  post_id    uuid not null references posts(id)      on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, post_id)
);

alter table bookmarks enable row level security;

create policy "users manage own bookmarks" on bookmarks
  for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index bookmarks_user_id_idx on bookmarks(user_id);
create index bookmarks_post_id_idx on bookmarks(post_id);
