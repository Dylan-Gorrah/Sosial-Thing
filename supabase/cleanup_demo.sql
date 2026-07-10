-- ═══════════════════════════════════════════════════════════════════════════
-- DEMO DATA CLEANUP — run ONCE, right before launch.
--
-- What it removes: the six fake demo accounts (kestrel, funkt4stic, nacicaba,
-- jamesch94, honlahaka, dragonpup — all @sodev.demo emails) and every trace
-- of them: posts, comments, votes, follows, badges, clout history,
-- notifications. It also resets Dylan's own account, which was seeded with
-- ~100,000 fake clout and badges for testing — left alone, that would poison
-- the launch leaderboard.
--
-- Safe to run twice (everything is a DELETE — second run just does nothing).
-- Wrapped in a transaction: it either all works or nothing changes.
--
-- HOW TO RUN: paste the whole file into the Supabase SQL editor and run it.
-- Want to peek first? Run just the PREVIEW query below on its own.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── PREVIEW (optional, run alone first) ──────────────────────────────────────
-- select 'posts' as what, count(*) from posts where user_id::text like 'a1b2c3d4-%'
-- union all select 'comments', count(*) from comments where user_id::text like 'a1b2c3d4-%'
-- union all select 'votes', count(*) from post_ratings where user_id::text like 'a1b2c3d4-%'
-- union all select 'accounts', count(*) from auth.users where email like '%@sodev.demo';

begin;

-- The six demo account ids, used throughout
create temp table demo_ids (id uuid) on commit drop;
insert into demo_ids values
  ('a1b2c3d4-0001-0001-0001-000000000001'),
  ('a1b2c3d4-0002-0002-0002-000000000002'),
  ('a1b2c3d4-0003-0003-0003-000000000003'),
  ('a1b2c3d4-0004-0004-0004-000000000004'),
  ('a1b2c3d4-0005-0005-0005-000000000005'),
  ('a1b2c3d4-0006-0006-0006-000000000006');

-- 1. Demo posts — cascade takes their images, comments, votes, tags,
--    showcase links, bookmarks and reports with them
delete from public.posts where user_id in (select id from demo_ids);

-- 2. Demo comments left on OTHER people's posts (comment counts self-correct
--    via the existing trigger)
delete from public.comments where user_id in (select id from demo_ids);

-- 3. Demo votes on other people's posts
delete from public.post_ratings where user_id in (select id from demo_ids);

-- 4. Follows in either direction (follower counts self-correct via trigger)
delete from public.follows
where follower_id  in (select id from demo_ids)
   or following_id in (select id from demo_ids);

-- 5. Their notification trails, clout history, badges, activity, memberships
delete from public.notifications
where user_id  in (select id from demo_ids)
   or actor_id in (select id from demo_ids);
delete from public.clout_transactions  where user_id in (select id from demo_ids);
delete from public.user_badges         where user_id in (select id from demo_ids);
delete from public.user_daily_activity where user_id in (select id from demo_ids);
delete from public.room_members        where user_id in (select id from demo_ids);
delete from public.reports             where reporter_id in (select id from demo_ids);

-- 6. The accounts themselves (cascades to profiles)
delete from auth.users where email like '%@sodev.demo';

-- 7. Reset Dylan's account — the seed gave it ~100,000 fake clout and five
--    badges. Real reputation starts at zero like everyone else. This does
--    NOT touch the account itself, its posts, or the admin flag.
update public.profiles
set clout_score = 0,
    clout_tier  = 'novice',
    streak      = 0
where username = 'dylangorrah';

delete from public.user_badges
where user_id = (select id from public.profiles where username = 'dylangorrah');

delete from public.clout_transactions
where user_id = (select id from public.profiles where username = 'dylangorrah');

commit;

-- ── AFTERWARDS (optional sanity check — all three should say 0) ─────────────
-- select 'demo accounts left' as what, count(*) from auth.users where email like '%@sodev.demo'
-- union all select 'demo posts left', count(*) from posts where user_id::text like 'a1b2c3d4-%'
-- union all select 'dylan fake clout', coalesce((select clout_score from profiles where username = 'dylangorrah'), 0);
