-- ============================================================================
-- Demo data for testing — NOT for production.
-- ----------------------------------------------------------------------------
-- Seven demo accounts, five rooms, ~18 posts (text / link / showcase, plus
-- three upcoming events), comments, follows, votes and a clout ledger that
-- makes the leaderboard look alive.
--
-- Every account logs in with password:  demopass123
-- Emails are @demo.sodev so they can never collide with a real signup.
--
-- Ordering matters:
--   1. auth.users insert fires handle_new_user() → profiles rows appear
--   2. profiles.created_at is backdated BEFORE any content, or award_clout's
--      "new account" gate (<24h → 50/day) clamps everything
--   3. content is inserted with backdated created_at so the rate-limit
--      triggers (5 posts/hour, 5 comments/minute) never fire
--   4. clout_score / streak / tier are set LAST, because award_clout and
--      update_streak overwrite them as content triggers fire
--
-- Wipe with supabase/cleanup_demo.sql before launch.
-- ============================================================================

-- ── 1. Auth users ───────────────────────────────────────────────────────────
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
SELECT
  u.id::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated', 'authenticated',
  u.username || '@demo.sodev',
  extensions.crypt('demopass123', extensions.gen_salt('bf')),
  u.joined::timestamptz, u.joined::timestamptz, now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('username', u.username),
  '', '', '', ''
FROM (VALUES
  ('11111111-1111-4111-8111-111111111111','kestrel',     '2026-02-10 09:00:00+00'),
  ('22222222-2222-4222-8222-222222222222','funkt4stic',  '2026-02-11 10:00:00+00'),
  ('33333333-3333-4333-8333-333333333333','nacicaba',    '2026-02-09 08:00:00+00'),
  ('44444444-4444-4444-8444-444444444444','jamesch94',   '2026-02-14 13:00:00+00'),
  ('55555555-5555-4555-8555-555555555555','honlahaka',   '2026-02-18 09:30:00+00'),
  ('66666666-6666-4666-8666-666666666666','dragonpup',   '2026-03-15 10:00:00+00'),
  ('77777777-7777-4777-8777-777777777777','dylangorrah', '2026-02-08 12:00:00+00')
) AS u(id, username, joined)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Profile identity + backdated created_at ──────────────────────────────
-- created_at must be > 24h old before any content lands, or every award_clout
-- call gets capped at 50/day by the new-account gate.
UPDATE profiles p SET
  created_at   = d.joined::timestamptz,
  join_date    = d.joined::timestamptz,
  display_name = d.display_name,
  bio          = d.bio,
  title        = d.title,
  location     = d.location,
  website      = d.website,
  github_url   = d.github_url,
  tech_stack   = d.tech_stack,
  is_admin     = d.is_admin
FROM (VALUES
  ('kestrel','Ana Kestrel','Systems person. I like small binaries and boring deploys.','Rust Systems Dev','Lisbon, PT','https://kestrel.dev','https://github.com/kestrel',ARRAY['Rust','WebAssembly','Postgres','Linux'],false,'2026-02-10 09:00:00+00'),
  ('funkt4stic','Mo Funk','Frontend. Obsessed with getting the first paint under 100ms.','Frontend Engineer','Berlin, DE','https://funk.tools','https://github.com/funkt4stic',ARRAY['TypeScript','React','Next.js','CSS'],false,'2026-02-11 10:00:00+00'),
  ('nacicaba','Naci Caba','Backend + infra. I write the boring glue that keeps things up.','Backend Engineer','Istanbul, TR',NULL,'https://github.com/nacicaba',ARRAY['Go','Postgres','Kubernetes','Terraform'],false,'2026-02-09 08:00:00+00'),
  ('jamesch94','James Chen','Half data engineer, half person who fixes the dashboard at 2am.','Data Engineer','Toronto, CA',NULL,'https://github.com/jamesch94',ARRAY['Python','dbt','Airflow','DuckDB'],false,'2026-02-14 13:00:00+00'),
  ('honlahaka','Hon Lahaka','Mobile dev. Shipping small apps that do one thing.','Mobile Developer','Auckland, NZ',NULL,NULL,ARRAY['Swift','Kotlin','Flutter'],false,'2026-02-18 09:30:00+00'),
  ('dragonpup','Sam Pup','Six months in. Learning in public, breaking things on purpose.','Code Newbie','Manchester, UK',NULL,'https://github.com/dragonpup',ARRAY['JavaScript','HTML','CSS'],false,'2026-03-15 10:00:00+00'),
  ('dylangorrah','Dylan Gorrah','Building SoDev. Ask me about the clout economy.','Founder','Cape Town, ZA',NULL,'https://github.com/Dylan-Gorrah',ARRAY['TypeScript','Next.js','Supabase','Postgres'],true,'2026-02-08 12:00:00+00')
) AS d(username, display_name, bio, title, location, website, github_url, tech_stack, is_admin, joined)
WHERE p.username = d.username;

-- ── 3. Rooms ────────────────────────────────────────────────────────────────
INSERT INTO rooms (id, name, description, type, created_by, tags, created_at) VALUES
  ('c0000001-0000-4000-8000-000000000001','Rust','Systems, WASM, and fighting the borrow checker in public.','public','11111111-1111-4111-8111-111111111111',ARRAY['rust','systems'],'2026-02-12 10:00:00+00'),
  ('c0000002-0000-4000-8000-000000000002','Frontend','Interfaces, performance, and CSS that behaves.','public','22222222-2222-4222-8222-222222222222',ARRAY['webdev','ui-ux'],'2026-02-16 09:00:00+00'),
  ('c0000003-0000-4000-8000-000000000003','Backend','APIs, databases, queues, and the 3am pager.','public','33333333-3333-4333-8333-333333333333',ARRAY['databases','devops'],'2026-02-13 08:30:00+00'),
  ('c0000004-0000-4000-8000-000000000004','Show and Tell','Post the thing you built. Demos over descriptions.','public','77777777-7777-4777-8777-777777777777',ARRAY['open-source'],'2026-02-20 12:00:00+00'),
  ('c0000005-0000-4000-8000-000000000005','Newbies','No stupid questions. Genuinely.','public','66666666-6666-4666-8666-666666666666',ARRAY['career'],'2026-03-16 11:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- Memberships (owner rows + cross-joins). Fires the join_room clout trigger.
INSERT INTO room_members (room_id, user_id, role) VALUES
  ('c0000001-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','owner'),
  ('c0000001-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333','member'),
  ('c0000001-0000-4000-8000-000000000001','77777777-7777-4777-8777-777777777777','member'),
  ('c0000002-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','owner'),
  ('c0000002-0000-4000-8000-000000000002','55555555-5555-4555-8555-555555555555','member'),
  ('c0000002-0000-4000-8000-000000000002','66666666-6666-4666-8666-666666666666','member'),
  ('c0000002-0000-4000-8000-000000000002','77777777-7777-4777-8777-777777777777','member'),
  ('c0000003-0000-4000-8000-000000000003','33333333-3333-4333-8333-333333333333','owner'),
  ('c0000003-0000-4000-8000-000000000003','44444444-4444-4444-8444-444444444444','member'),
  ('c0000003-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','member'),
  ('c0000004-0000-4000-8000-000000000004','77777777-7777-4777-8777-777777777777','owner'),
  ('c0000004-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','member'),
  ('c0000004-0000-4000-8000-000000000004','22222222-2222-4222-8222-222222222222','member'),
  ('c0000004-0000-4000-8000-000000000004','44444444-4444-4444-8444-444444444444','member'),
  ('c0000005-0000-4000-8000-000000000005','66666666-6666-4666-8666-666666666666','owner'),
  ('c0000005-0000-4000-8000-000000000005','55555555-5555-4555-8555-555555555555','member'),
  ('c0000005-0000-4000-8000-000000000005','22222222-2222-4222-8222-222222222222','member')
ON CONFLICT (room_id, user_id) DO NOTHING;

-- ── 4. Posts ────────────────────────────────────────────────────────────────
-- format is derived from content, per the repo rule: showcase = has repo/demo
-- links, link = has link_url, text = neither. No media posts: there are no
-- uploaded images in a fresh project and an empty gallery reads as broken.
INSERT INTO posts (id, user_id, room_id, title, body_md, format, link_url, is_oc, created_at) VALUES
  ('a0000001-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','c0000001-0000-4000-8000-000000000001',
   'Cut our WASM bundle from 2.1MB to 340KB',
   E'Three things did almost all of it:\n\n1. `opt-level = "z"` and `lto = "fat"` in the release profile\n2. Dropped `serde_json` for a hand-rolled parser — we only ever read four fields\n3. `wasm-opt -Oz` as a post-build step\n\nThe parser swap alone was 900KB. Worth checking what your serialiser is dragging in before you go micro-optimising anything else.',
   'text', NULL, true, now() - interval '6 days'),

  ('a0000002-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','c0000002-0000-4000-8000-000000000002',
   'The CSS `content-visibility` trick actually works',
   E'Long feed pages: add `content-visibility: auto` plus `contain-intrinsic-size` to each card and the browser skips layout for anything offscreen.\n\nOur profile page went from 340ms to 90ms scripting time on a mid-range Android. One line. No virtual list library.\n\nCaveat: get `contain-intrinsic-size` roughly right or your scrollbar jumps around like a maniac.',
   'text', NULL, true, now() - interval '5 days'),

  ('a0000003-0000-4000-8000-000000000003','33333333-3333-4333-8333-333333333333','c0000003-0000-4000-8000-000000000003',
   'Postgres advisory locks beat a queue for this one job',
   E'We had a nightly reconciliation job running on three app instances. Classic double-run problem.\n\nInstead of adding Redis and a proper queue, we used `pg_try_advisory_lock(hashtext(''nightly-recon''))`. If you get the lock you run, if you do not you exit. Ten lines, no new infrastructure.\n\nThis is not a general queue replacement — no retries, no visibility, no fan-out. But for "exactly one of these should run" it is hard to beat.',
   'text', NULL, true, now() - interval '5 days'),

  ('a0000004-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','c0000004-0000-4000-8000-000000000004',
   'ferrite — a 4MB static site generator in Rust',
   E'Weekend project that got out of hand. Markdown in, static site out, no config file unless you want one.\n\nSingle binary, no runtime dependencies. It does incremental rebuilds by hashing frontmatter and content separately, so touching a layout does not rebuild every page.\n\nStill rough: no plugin system, and the dev server reloads the whole page instead of hot-swapping CSS.',
   'showcase', NULL, true, now() - interval '4 days'),

  ('a0000005-0000-4000-8000-000000000005','44444444-4444-4444-8444-444444444444','c0000003-0000-4000-8000-000000000003',
   'DuckDB replaced our whole staging pipeline',
   E'We were running Spark on a 40GB daily export. Forty gigabytes. On Spark.\n\nSwapped it for DuckDB reading Parquet straight off S3. Same transforms, 6 minutes instead of 50, running on one machine that costs less per month than the old cluster did per day.\n\nIf your "big data" fits on a laptop SSD, it is not big data.',
   'text', NULL, true, now() - interval '4 days'),

  ('a0000006-0000-4000-8000-000000000006','55555555-5555-4555-8555-555555555555','c0000002-0000-4000-8000-000000000002',
   'Why I stopped using a cross-platform framework',
   E'Two years of Flutter, then back to native Swift and Kotlin for the last app.\n\nThe framework was genuinely fine for the 80% — lists, forms, navigation. It fell apart on the 20% that made the app worth using: the camera pipeline, background sync, and anything touching platform permissions.\n\nI spent more time writing platform channels than I would have spent writing two apps. Your mileage will vary wildly by app category.',
   'text', NULL, true, now() - interval '3 days'),

  ('a0000007-0000-4000-8000-000000000007','66666666-6666-4666-8666-666666666666','c0000005-0000-4000-8000-000000000005',
   'I finally understand what a closure is',
   E'Six months of nodding along and pretending. What made it click:\n\nA closure is just a function that remembers the variables that were around when it was created. That is it. The function carries a little backpack of context with it.\n\nThe thing that confused me was every explanation using counters. Nobody makes counters. The moment I saw it as "this callback still knows which button it belongs to", it was obvious.',
   'text', NULL, true, now() - interval '3 days'),

  ('a0000008-0000-4000-8000-000000000008','22222222-2222-4222-8222-222222222222','c0000004-0000-4000-8000-000000000004',
   'palette-lint — catches contrast bugs in your design tokens',
   E'CLI that reads your CSS custom properties, works out every foreground/background pair you actually use, and fails the build if any of them drop below WCAG AA.\n\nBuilt it because we shipped a light-mode regression three sprints running. It found eleven existing violations the first time we ran it, which was humbling.',
   'showcase', NULL, true, now() - interval '2 days'),

  ('a0000009-0000-4000-8000-000000000009','33333333-3333-4333-8333-333333333333',NULL,
   'A good writeup on database connection pooling',
   E'Best explanation of pool sizing I have read. The counterintuitive bit: smaller pools are usually faster, because you stop thrashing the database with more concurrent work than it has cores to do.\n\nWe dropped from 100 connections to 20 and p99 latency halved.',
   'link', 'https://www.postgresql.org/docs/current/runtime-config-connection.html', false, now() - interval '2 days'),

  ('a0000010-0000-4000-8000-000000000010','11111111-1111-4111-8111-111111111111','c0000001-0000-4000-8000-000000000001',
   'The borrow checker is a design tool, not an obstacle',
   E'Unpopular take: most of the time I fight the borrow checker, the borrow checker is right and my design is bad.\n\nThe fights I lose are usually because I tried to share mutable state between two things that should not have known about each other. Restructuring so ownership is clear almost always produces a better design than the one I was defending.\n\nThe genuine exceptions are graphs and observer patterns. Those are real pain and I am not going to pretend otherwise.',
   'text', NULL, true, now() - interval '46 hours'),

  ('a0000011-0000-4000-8000-000000000011','44444444-4444-4444-8444-444444444444',NULL,
   'Stop using UUIDs as your primary key (sometimes)',
   E'Random UUIDv4 as a clustered primary key destroys insert performance at scale — every insert lands in a random page, so your index is constantly splitting.\n\nUUIDv7 fixes this. It is time-ordered, so inserts append instead of scattering. Same uniqueness guarantees, same 128 bits.\n\nIf you are on Postgres and under a few million rows you will genuinely never notice. Past that it is measurable.',
   'text', NULL, true, now() - interval '30 hours'),

  ('a0000012-0000-4000-8000-000000000012','77777777-7777-4777-8777-777777777777','c0000004-0000-4000-8000-000000000004',
   'How SoDev''s clout system resists farming',
   E'Every earning path has a cap, and the caps compose:\n\n- Per-action daily caps (posts pay 5, capped at 15/day)\n- A global 200/day ceiling\n- A pair-wise cap: you can earn at most 10/day sourced from any single other account, which kills two-account loops\n- New accounts are held to 50/day for their first 24 hours\n- Re-voting never pays twice — one award per (voter, item), ever\n\nThe design goal was that farming should cost more effort than just building something.',
   'text', NULL, true, now() - interval '28 hours'),

  ('a0000013-0000-4000-8000-000000000013','55555555-5555-4555-8555-555555555555','c0000005-0000-4000-8000-000000000005',
   'Reading other people''s code is a separate skill',
   E'Nobody teaches this and it is most of the job.\n\nWhat helped me: stop reading top to bottom. Find the entry point, then follow one single path all the way through and ignore everything else. You do not need to understand the file. You need to understand the path.\n\nI wasted two years thinking I was slow at this when I was just doing it wrong.',
   'text', NULL, true, now() - interval '20 hours'),

  ('a0000014-0000-4000-8000-000000000014','66666666-6666-4666-8666-666666666666',NULL,
   'First time my code broke production and it was fine',
   E'Pushed a migration that locked a table for four minutes during business hours. Site was down. I felt sick.\n\nMy lead''s reaction was to fix it, then write it up, then ask why our migration tooling let it happen. Nobody was angry. The postmortem changed the tooling.\n\nIf you are early in this and terrified of breaking things: the culture around the mistake matters more than the mistake.',
   'text', NULL, true, now() - interval '14 hours'),

  ('a0000015-0000-4000-8000-000000000015','33333333-3333-4333-8333-333333333333','c0000003-0000-4000-8000-000000000003',
   'kettle — Terraform module linter with opinions',
   E'Checks your modules for the stuff that bites six months later: unpinned provider versions, resources without tags, security groups open to 0.0.0.0/0, and state buckets without versioning.\n\nIt is deliberately opinionated and will annoy you. That is the point.',
   'showcase', NULL, true, now() - interval '9 hours'),

  -- ── Events (posts with is_event, per the events-on-posts design) ──────────
  ('a0000016-0000-4000-8000-000000000016','77777777-7777-4777-8777-777777777777','c0000004-0000-4000-8000-000000000004',
   'SoDev Build Night — ship something in three hours',
   E'Bring a half-finished thing and finish it. Or start something and get it to "runs on my machine".\n\nNo talks, no slides. We build, then everyone demos for two minutes at the end. Demos can absolutely fail — that is more interesting anyway.',
   'text', NULL, true, now() - interval '3 days'),

  ('a0000017-0000-4000-8000-000000000017','11111111-1111-4111-8111-111111111111','c0000001-0000-4000-8000-000000000001',
   'Rust reading group — async runtimes from scratch',
   E'We are working through building a toy async runtime, one piece a week. This session: wakers, and why they are shaped the way they are.\n\nCome having read nothing. We go slowly and stop for questions constantly.',
   'text', NULL, true, now() - interval '2 days'),

  ('a0000018-0000-4000-8000-000000000018','22222222-2222-4222-8222-222222222222','c0000002-0000-4000-8000-000000000002',
   'Frontend perf clinic — bring your slow page',
   E'Bring a real URL that is slow. We profile it live, as a group, and you leave with an actual list of what to fix.\n\nFirst four people to post a link get looked at. Everyone else can heckle usefully.',
   'text', NULL, true, now() - interval '20 hours')
ON CONFLICT (id) DO NOTHING;

-- Event flags + start times (all in the future so the Explore rail has content)
UPDATE posts SET is_event = true, event_starts_at = now() + interval '3 days'  WHERE id = 'a0000016-0000-4000-8000-000000000016';
UPDATE posts SET is_event = true, event_starts_at = now() + interval '6 days'  WHERE id = 'a0000017-0000-4000-8000-000000000017';
UPDATE posts SET is_event = true, event_starts_at = now() + interval '10 days' WHERE id = 'a0000018-0000-4000-8000-000000000018';

-- Showcase metadata — this is what makes format = 'showcase' truthful
INSERT INTO showcase_meta (post_id, repo_url, demo_url) VALUES
  ('a0000004-0000-4000-8000-000000000004','https://github.com/kestrel/ferrite','https://ferrite.kestrel.dev'),
  ('a0000008-0000-4000-8000-000000000008','https://github.com/funkt4stic/palette-lint',NULL),
  ('a0000015-0000-4000-8000-000000000015','https://github.com/nacicaba/kettle',NULL)
ON CONFLICT (post_id) DO NOTHING;

-- ── 5. Tags on posts ────────────────────────────────────────────────────────
INSERT INTO post_tags (post_id, tag_id)
SELECT p.post_id::uuid, t.id
FROM (VALUES
  ('a0000001-0000-4000-8000-000000000001','rust'),
  ('a0000002-0000-4000-8000-000000000002','webdev'),
  ('a0000002-0000-4000-8000-000000000002','ui-ux'),
  ('a0000003-0000-4000-8000-000000000003','databases'),
  ('a0000004-0000-4000-8000-000000000004','rust'),
  ('a0000004-0000-4000-8000-000000000004','open-source'),
  ('a0000005-0000-4000-8000-000000000005','databases'),
  ('a0000006-0000-4000-8000-000000000006','mobile'),
  ('a0000007-0000-4000-8000-000000000007','career'),
  ('a0000008-0000-4000-8000-000000000008','ui-ux'),
  ('a0000008-0000-4000-8000-000000000008','open-source'),
  ('a0000009-0000-4000-8000-000000000009','databases'),
  ('a0000010-0000-4000-8000-000000000010','rust'),
  ('a0000011-0000-4000-8000-000000000011','databases'),
  ('a0000012-0000-4000-8000-000000000012','webdev'),
  ('a0000013-0000-4000-8000-000000000013','career'),
  ('a0000014-0000-4000-8000-000000000014','career'),
  ('a0000015-0000-4000-8000-000000000015','devops'),
  ('a0000015-0000-4000-8000-000000000015','cloud')
) AS p(post_id, slug)
JOIN tags t ON t.slug = p.slug
ON CONFLICT (post_id, tag_id) DO NOTHING;

-- ── 6. Comments ─────────────────────────────────────────────────────────────
-- Backdated so the 5-per-minute rate-limit trigger stays quiet.
INSERT INTO comments (id, post_id, user_id, content, created_at) VALUES
  ('b0000001-0000-4000-8000-000000000001','a0000001-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333','The serde swap matching the biggest win tracks. It pulls in a lot of monomorphised code you never call.','2026-08-30 11:00:00+00'),
  ('b0000002-0000-4000-8000-000000000002','a0000001-0000-4000-8000-000000000001','77777777-7777-4777-8777-777777777777','Did you measure the parse-time cost of the hand-rolled parser, or was it a wash?','2026-08-30 12:30:00+00'),
  ('b0000003-0000-4000-8000-000000000003','a0000001-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Slightly faster actually, but only because we skip the fields we do not need. Not a fair comparison.','2026-08-30 13:15:00+00'),
  ('b0000004-0000-4000-8000-000000000004','a0000002-0000-4000-8000-000000000002','55555555-5555-4555-8555-555555555555','The scrollbar jump caught us out too. Ended up measuring one card and hardcoding the value.','2026-08-31 09:20:00+00'),
  ('b0000005-0000-4000-8000-000000000005','a0000002-0000-4000-8000-000000000002','66666666-6666-4666-8666-666666666666','Saving this. Our feed is exactly this problem and I did not know this property existed.','2026-08-31 10:05:00+00'),
  ('b0000006-0000-4000-8000-000000000006','a0000003-0000-4000-8000-000000000003','44444444-4444-4444-8444-444444444444','Advisory locks are so underused. The one gotcha is they are per-connection, so a pooler in transaction mode will ruin your day.','2026-08-31 14:00:00+00'),
  ('b0000007-0000-4000-8000-000000000007','a0000003-0000-4000-8000-000000000003','33333333-3333-4333-8333-333333333333','Good call — worth adding to the post. We are on session pooling so it did not bite us.','2026-08-31 15:10:00+00'),
  ('b0000008-0000-4000-8000-000000000008','a0000004-0000-4000-8000-000000000004','22222222-2222-4222-8222-222222222222','Ran the demo. Incremental rebuild on a 200-page site was under 400ms. Genuinely quick.','2026-09-01 10:00:00+00'),
  ('b0000009-0000-4000-8000-000000000009','a0000004-0000-4000-8000-000000000004','44444444-4444-4444-8444-444444444444','Does it handle nested collections, or is it flat pages only right now?','2026-09-01 11:30:00+00'),
  ('b0000010-0000-4000-8000-000000000010','a0000005-0000-4000-8000-000000000005','33333333-3333-4333-8333-333333333333','The "if it fits on a laptop SSD it is not big data" line should be on a poster in every data team office.','2026-09-01 13:00:00+00'),
  ('b0000011-0000-4000-8000-000000000011','a0000005-0000-4000-8000-000000000005','11111111-1111-4111-8111-111111111111','Curious what your memory ceiling looked like. DuckDB is happy to spill but it gets slow when it does.','2026-09-01 14:20:00+00'),
  ('b0000012-0000-4000-8000-000000000012','a0000006-0000-4000-8000-000000000006','22222222-2222-4222-8222-222222222222','Platform channels being the tax nobody mentions in the framework pitch is very real.','2026-09-02 09:00:00+00'),
  ('b0000013-0000-4000-8000-000000000013','a0000007-0000-4000-8000-000000000007','11111111-1111-4111-8111-111111111111','The "every explanation uses counters" observation is genuinely good feedback for anyone writing tutorials.','2026-09-02 10:15:00+00'),
  ('b0000014-0000-4000-8000-000000000014','a0000007-0000-4000-8000-000000000007','55555555-5555-4555-8555-555555555555','Welcome to the other side. It stops being scary and starts being a tool you reach for.','2026-09-02 11:00:00+00'),
  ('b0000015-0000-4000-8000-000000000015','a0000008-0000-4000-8000-000000000008','77777777-7777-4777-8777-777777777777','Eleven existing violations is the most relatable part of this whole post.','2026-09-02 15:00:00+00'),
  ('b0000016-0000-4000-8000-000000000016','a0000011-0000-4000-8000-000000000011','33333333-3333-4333-8333-333333333333','UUIDv7 support landed in enough client libraries this year that there is not much excuse left.','2026-09-03 09:30:00+00'),
  ('b0000017-0000-4000-8000-000000000017','a0000012-0000-4000-8000-000000000012','44444444-4444-4444-8444-444444444444','The pair-wise cap is the clever bit. Most systems only cap totals and the two-account loop walks right through.','2026-09-03 12:00:00+00'),
  ('b0000018-0000-4000-8000-000000000018','a0000013-0000-4000-8000-000000000013','66666666-6666-4666-8666-666666666666','"You do not need to understand the file, you need to understand the path" just fixed something in my head.','2026-09-03 16:00:00+00'),
  ('b0000019-0000-4000-8000-000000000019','a0000014-0000-4000-8000-000000000014','11111111-1111-4111-8111-111111111111','Everyone has one of these. Anyone who says they do not has not shipped enough.','2026-09-04 06:00:00+00'),
  ('b0000020-0000-4000-8000-000000000020','a0000014-0000-4000-8000-000000000014','77777777-7777-4777-8777-777777777777','Good lead. Changing the tooling instead of blaming the person is the whole thing.','2026-09-04 07:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- ── 7. Follows ──────────────────────────────────────────────────────────────
-- Fires follower_count triggers + new_follower notifications.
INSERT INTO follows (follower_id, following_id) VALUES
  ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111'),
  ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111'),
  ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111'),
  ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111'),
  ('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111'),
  ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'),
  ('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222'),
  ('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222'),
  ('77777777-7777-4777-8777-777777777777','22222222-2222-4222-8222-222222222222'),
  ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333'),
  ('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333'),
  ('77777777-7777-4777-8777-777777777777','33333333-3333-4333-8333-333333333333'),
  ('33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'),
  ('77777777-7777-4777-8777-777777777777','44444444-4444-4444-8444-444444444444'),
  ('22222222-2222-4222-8222-222222222222','55555555-5555-4555-8555-555555555555'),
  ('66666666-6666-4666-8666-666666666666','55555555-5555-4555-8555-555555555555'),
  ('55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666'),
  ('11111111-1111-4111-8111-111111111111','77777777-7777-4777-8777-777777777777'),
  ('22222222-2222-4222-8222-222222222222','77777777-7777-4777-8777-777777777777'),
  ('33333333-3333-4333-8333-333333333333','77777777-7777-4777-8777-777777777777'),
  ('66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777')
ON CONFLICT (follower_id, following_id) DO NOTHING;

-- ── 8. Tag follows ──────────────────────────────────────────────────────────
INSERT INTO tag_follows (user_id, tag_id)
SELECT u.id::uuid, t.id
FROM (VALUES
  ('11111111-1111-4111-8111-111111111111','rust'),
  ('11111111-1111-4111-8111-111111111111','linux'),
  ('22222222-2222-4222-8222-222222222222','webdev'),
  ('22222222-2222-4222-8222-222222222222','ui-ux'),
  ('33333333-3333-4333-8333-333333333333','databases'),
  ('33333333-3333-4333-8333-333333333333','devops'),
  ('44444444-4444-4444-8444-444444444444','databases'),
  ('44444444-4444-4444-8444-444444444444','python'),
  ('55555555-5555-4555-8555-555555555555','mobile'),
  ('66666666-6666-4666-8666-666666666666','career'),
  ('66666666-6666-4666-8666-666666666666','webdev'),
  ('77777777-7777-4777-8777-777777777777','open-source'),
  ('77777777-7777-4777-8777-777777777777','typescript')
) AS u(id, slug)
JOIN tags t ON t.slug = u.slug
ON CONFLICT (user_id, tag_id) DO NOTHING;

-- ── 9. Votes ────────────────────────────────────────────────────────────────
-- Written directly (this script runs as postgres, so RLS does not apply).
-- vote_post owns this table at runtime, so posts.clout is set explicitly below
-- rather than being accumulated by the RPC.
INSERT INTO post_ratings (post_id, user_id, rating)
SELECT v.post_id::uuid, v.user_id::uuid, 5
FROM (VALUES
  ('a0000001-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222'),
  ('a0000001-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333'),
  ('a0000001-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444'),
  ('a0000001-0000-4000-8000-000000000001','77777777-7777-4777-8777-777777777777'),
  ('a0000002-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111'),
  ('a0000002-0000-4000-8000-000000000002','55555555-5555-4555-8555-555555555555'),
  ('a0000002-0000-4000-8000-000000000002','66666666-6666-4666-8666-666666666666'),
  ('a0000003-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111'),
  ('a0000003-0000-4000-8000-000000000003','44444444-4444-4444-8444-444444444444'),
  ('a0000004-0000-4000-8000-000000000004','22222222-2222-4222-8222-222222222222'),
  ('a0000004-0000-4000-8000-000000000004','44444444-4444-4444-8444-444444444444'),
  ('a0000004-0000-4000-8000-000000000004','77777777-7777-4777-8777-777777777777'),
  ('a0000005-0000-4000-8000-000000000005','11111111-1111-4111-8111-111111111111'),
  ('a0000005-0000-4000-8000-000000000005','33333333-3333-4333-8333-333333333333'),
  ('a0000006-0000-4000-8000-000000000006','22222222-2222-4222-8222-222222222222'),
  ('a0000007-0000-4000-8000-000000000007','11111111-1111-4111-8111-111111111111'),
  ('a0000007-0000-4000-8000-000000000007','55555555-5555-4555-8555-555555555555'),
  ('a0000008-0000-4000-8000-000000000008','11111111-1111-4111-8111-111111111111'),
  ('a0000008-0000-4000-8000-000000000008','77777777-7777-4777-8777-777777777777'),
  ('a0000010-0000-4000-8000-000000000010','33333333-3333-4333-8333-333333333333'),
  ('a0000011-0000-4000-8000-000000000011','33333333-3333-4333-8333-333333333333'),
  ('a0000012-0000-4000-8000-000000000012','44444444-4444-4444-8444-444444444444'),
  ('a0000012-0000-4000-8000-000000000012','11111111-1111-4111-8111-111111111111'),
  ('a0000013-0000-4000-8000-000000000013','66666666-6666-4666-8666-666666666666'),
  ('a0000015-0000-4000-8000-000000000015','11111111-1111-4111-8111-111111111111')
) AS v(post_id, user_id)
ON CONFLICT (post_id, user_id) DO NOTHING;

UPDATE posts p
SET clout = (SELECT COUNT(*) FROM post_ratings r WHERE r.post_id = p.id AND r.rating = 5);

-- ── 10. Peer verifications ──────────────────────────────────────────────────
-- Three weight gets a post the verified badge. Written directly so the
-- Contributor-tier gate in verify_post does not block seeding.
INSERT INTO post_verifications (post_id, verifier_id, evidence, weight) VALUES
  ('a0000004-0000-4000-8000-000000000004','22222222-2222-4222-8222-222222222222','ran_demo',1.0),
  ('a0000004-0000-4000-8000-000000000004','44444444-4444-4444-8444-444444444444','read_code',1.0),
  ('a0000004-0000-4000-8000-000000000004','77777777-7777-4777-8777-777777777777','ran_demo',1.0),
  ('a0000008-0000-4000-8000-000000000008','11111111-1111-4111-8111-111111111111','ran_demo',1.0),
  ('a0000008-0000-4000-8000-000000000008','44444444-4444-4444-8444-444444444444','read_code',1.0),
  ('a0000008-0000-4000-8000-000000000008','77777777-7777-4777-8777-777777777777','watched_it_work',1.0)
ON CONFLICT (post_id, verifier_id) DO NOTHING;

UPDATE posts SET verified = true, verified_at = created_at + interval '1 day'
WHERE id IN ('a0000004-0000-4000-8000-000000000004','a0000008-0000-4000-8000-000000000008');

-- ── 11. Clout ledger ────────────────────────────────────────────────────────
-- The leaderboard is a query over this table, not over profiles.clout_score,
-- so it needs rows inside the default 7-day window to show anything.
INSERT INTO clout_transactions (user_id, action_type, clout_amount, created_at)
SELECT t.user_id::uuid, t.action_type, t.amount, now() - (t.days_ago || ' days')::interval
FROM (VALUES
  ('11111111-1111-4111-8111-111111111111','post_upvoted',    12, 6),
  ('11111111-1111-4111-8111-111111111111','post_created',     5, 6),
  ('11111111-1111-4111-8111-111111111111','post_verified',   25, 4),
  ('11111111-1111-4111-8111-111111111111','post_upvoted',    15, 3),
  ('11111111-1111-4111-8111-111111111111','comment_upvoted',  6, 2),
  ('11111111-1111-4111-8111-111111111111','post_held_up',     5, 1),
  ('22222222-2222-4222-8222-222222222222','post_created',     5, 5),
  ('22222222-2222-4222-8222-222222222222','post_upvoted',     9, 5),
  ('22222222-2222-4222-8222-222222222222','post_verified',   25, 2),
  ('22222222-2222-4222-8222-222222222222','verified_post',    3, 4),
  ('22222222-2222-4222-8222-222222222222','comment_upvoted',  4, 1),
  ('33333333-3333-4333-8333-333333333333','post_created',     5, 5),
  ('33333333-3333-4333-8333-333333333333','post_upvoted',     6, 4),
  ('33333333-3333-4333-8333-333333333333','comment_created',  2, 3),
  ('33333333-3333-4333-8333-333333333333','comment_upvoted',  8, 2),
  ('33333333-3333-4333-8333-333333333333','post_held_up',     5, 1),
  ('44444444-4444-4444-8444-444444444444','post_created',     5, 4),
  ('44444444-4444-4444-8444-444444444444','post_upvoted',     3, 3),
  ('44444444-4444-4444-8444-444444444444','verified_post',    3, 2),
  ('44444444-4444-4444-8444-444444444444','comment_upvoted',  4, 1),
  ('55555555-5555-4555-8555-555555555555','post_created',     5, 3),
  ('55555555-5555-4555-8555-555555555555','post_upvoted',     3, 2),
  ('55555555-5555-4555-8555-555555555555','comment_created',  2, 1),
  ('66666666-6666-4666-8666-666666666666','post_created',     5, 3),
  ('66666666-6666-4666-8666-666666666666','post_upvoted',     3, 1),
  ('66666666-6666-4666-8666-666666666666','comment_upvoted',  2, 1),
  ('77777777-7777-4777-8777-777777777777','post_created',     5, 2),
  ('77777777-7777-4777-8777-777777777777','post_upvoted',     6, 1),
  ('77777777-7777-4777-8777-777777777777','verified_post',    6, 3),
  ('77777777-7777-4777-8777-777777777777','comment_upvoted',  4, 1)
) AS t(user_id, action_type, amount, days_ago);

-- ── 12. Final profile stats ─────────────────────────────────────────────────
-- Last, because award_clout and update_streak overwrite these as the content
-- triggers above fire. follower_count / following_count are left alone —
-- the follows triggers computed them correctly.
UPDATE profiles p SET
  clout_score        = d.clout,
  clout_tier         = CASE
                         WHEN d.clout >= 10000 THEN 'legend'
                         WHEN d.clout >= 2000  THEN 'influencer'
                         WHEN d.clout >= 500   THEN 'contributor'
                         ELSE 'novice'
                       END,
  streak             = d.streak,
  last_activity_date = CURRENT_DATE
FROM (VALUES
  ('kestrel',     12500, 45),
  ('funkt4stic',  11200, 28),
  ('nacicaba',    10800, 62),
  ('jamesch94',    4500, 14),
  ('honlahaka',    2800,  7),
  ('dragonpup',     850,  3),
  ('dylangorrah',  9400, 31)
) AS d(username, clout, streak)
WHERE p.username = d.username;

-- Badges, now that the stats they key off are final
SELECT check_and_award_badges(id) FROM profiles;
