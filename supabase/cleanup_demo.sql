-- ═══════════════════════════════════════════════════════════════════════════
-- DEMO DATA CLEANUP — run ONCE, right before launch.
--
-- What it removes: the seven demo accounts seeded by supabase/seed/demo_data.sql
-- (kestrel, funkt4stic, nacicaba, jamesch94, honlahaka, dragonpup, dylangorrah
-- — all @demo.sodev emails) and every trace of them: posts, comments, votes,
-- follows, badges, clout history, notifications, verifications. It also removes
-- the five demo rooms, which the demo accounts own.
--
-- Safe to run twice (everything is a DELETE — second run just does nothing).
-- Wrapped in a transaction: it either all works or nothing changes.
--
-- HOW TO RUN: paste the whole file into the Supabase SQL editor and run it.
-- Want to peek first? Run just the PREVIEW query below on its own.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ READ THIS FIRST — two things changed when we moved to the new project:
--
-- 1. `dylangorrah` is now a DEMO account (dylangorrah@demo.sodev), not your
--    real one. It gets deleted like the rest. Your real account is whatever
--    you sign up with — and it starts at zero clout, so there is nothing to
--    reset any more.
--
--    After launch, make your real account an admin:
--      update public.profiles set is_admin = true where username = '<your-username>';
--
-- 2. The demo accounts OWN the five demo rooms (Rust, Frontend, Backend,
--    Show and Tell, Newbies). Deleting them takes those rooms with them.
--    If real users have posted in those rooms by then, their posts SURVIVE
--    but become roomless (posts.room_id is ON DELETE SET NULL) — they will
--    still show in the global feed, just without a room.
--    If you want to keep any of those rooms, hand it over BEFORE running this:
--      update public.rooms set created_by = '<your-user-id>' where name = 'Rust';
--      update public.room_members set role = 'owner'
--        where room_id = (select id from rooms where name = 'Rust')
--          and user_id = '<your-user-id>';
-- ═══════════════════════════════════════════════════════════════════════════

-- ── PREVIEW (optional, run alone first) ──────────────────────────────────────
-- select 'accounts' as what, count(*) from auth.users where email like '%@demo.sodev'
-- union all select 'posts',    count(*) from posts    where user_id in (select id from profiles where username in ('kestrel','funkt4stic','nacicaba','jamesch94','honlahaka','dragonpup','dylangorrah'))
-- union all select 'comments', count(*) from comments where user_id in (select id from profiles where username in ('kestrel','funkt4stic','nacicaba','jamesch94','honlahaka','dragonpup','dylangorrah'))
-- union all select 'rooms',    count(*) from rooms    where created_by in (select id from profiles where username in ('kestrel','funkt4stic','nacicaba','jamesch94','honlahaka','dragonpup','dylangorrah'));

begin;

-- The seven demo account ids, resolved by email so this stays correct even if
-- the seed is re-run with fresh uuids.
create temp table demo_ids (id uuid) on commit drop;
insert into demo_ids
  select id from auth.users where email like '%@demo.sodev';

-- 1. Demo posts — cascade takes their images, comments, votes, tags,
--    showcase links, bookmarks, verifications and reports with them
delete from public.posts where user_id in (select id from demo_ids);

-- 2. Demo comments left on OTHER people's posts (comment counts self-correct
--    via the existing trigger)
delete from public.comments where user_id in (select id from demo_ids);

-- 3. Demo votes, comment likes, verifications and slop flags on other
--    people's content
delete from public.post_ratings       where user_id     in (select id from demo_ids);
delete from public.comment_likes      where user_id     in (select id from demo_ids);
delete from public.post_verifications where verifier_id in (select id from demo_ids);
delete from public.slop_flags         where flagger_id  in (select id from demo_ids);

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
delete from public.tag_follows         where user_id in (select id from demo_ids);
delete from public.bookmarks           where user_id in (select id from demo_ids);
delete from public.room_members        where user_id in (select id from demo_ids);
delete from public.reports             where reporter_id in (select id from demo_ids);

-- 6. The demo rooms. Explicit rather than relying on the cascade, so it is
--    obvious this happens. Any real posts inside them go roomless, not away.
delete from public.rooms where created_by in (select id from demo_ids);

-- 7. The accounts themselves (cascades to profiles)
delete from auth.users where id in (select id from demo_ids);

commit;

-- ── AFTERWARDS (optional sanity check — all four should say 0) ──────────────
-- select 'demo accounts left' as what, count(*) from auth.users where email like '%@demo.sodev'
-- union all select 'demo profiles left', count(*) from profiles where username in ('kestrel','funkt4stic','nacicaba','jamesch94','honlahaka','dragonpup','dylangorrah')
-- union all select 'demo rooms left',    count(*) from rooms where name in ('Rust','Frontend','Backend','Show and Tell','Newbies')
-- union all select 'orphan posts',       count(*) from posts p where not exists (select 1 from profiles pr where pr.id = p.user_id);
