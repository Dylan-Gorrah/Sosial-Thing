-- ═══════════════════════════════════════════════════════════════════════════
-- HACKATHON KIT 2 of 3 — the room and the tag.
--
-- Creates the public "Hackathon" room (owned by Dylan) where all entries get
-- posted, plus a "hackathon" tag people can put on their entry posts.
--
-- Two things happen automatically once this exists:
--   - The Explore page shows its event banner (it looks for a room whose
--     name contains "hackathon")
--   - The room gets its own leaderboard and mod queue like any other room
--
-- Safe to run twice — it checks before inserting.
-- ═══════════════════════════════════════════════════════════════════════════

-- The room — public, owned by Dylan, joined by him automatically
insert into public.rooms (name, description, type, created_by)
select
  'Hackathon',
  'The official Sideyard hackathon. Post your entry here as a showcase post: repo link required, demo video and images encouraged. Community voting decides the winner.',
  'public',
  p.id
from public.profiles p
where p.username = 'dylangorrah'
  and not exists (select 1 from public.rooms where lower(name) = 'hackathon');

-- Owner joins their own room (member count trigger handles the rest)
insert into public.room_members (room_id, user_id, role)
select r.id, r.created_by, 'owner'
from public.rooms r
where lower(r.name) = 'hackathon'
on conflict do nothing;

-- The entry tag
insert into public.tags (slug, name, description)
values ('hackathon', 'hackathon', 'Official hackathon entries')
on conflict (slug) do nothing;
