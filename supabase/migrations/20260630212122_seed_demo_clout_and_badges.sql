
-- ── 1. Award badges matched to each demo user's actual stats ─────────────────
WITH user_ids AS (
  SELECT id, username FROM profiles
  WHERE username IN ('kestrel','funkt4stic','nacicaba','jamesch94','honlahaka','dragonpup','dylangorrah')
),
badge_ids AS (
  SELECT id, requirement FROM badges
),
assignments (username, requirement, unlocked_at) AS (
  VALUES
    -- kestrel: legend, 12 500 clout, 45-day streak
    ('kestrel',    'first_hundred',        '2025-02-10 09:15:00+00'::timestamptz),
    ('kestrel',    'first_project',        '2025-02-12 14:30:00+00'::timestamptz),
    ('kestrel',    'complete_profile',     '2025-02-12 14:36:00+00'::timestamptz),
    ('kestrel',    'seven_day_streak',     '2025-02-19 08:00:00+00'::timestamptz),
    ('kestrel',    'thirty_day_streak',    '2025-03-14 08:00:00+00'::timestamptz),
    ('kestrel',    'thousand_clout',       '2025-03-01 11:00:00+00'::timestamptz),
    ('kestrel',    'five_thousand_clout',  '2025-04-20 16:45:00+00'::timestamptz),
    ('kestrel',    'ten_thousand_clout',   '2025-05-28 10:22:00+00'::timestamptz),

    -- funkt4stic: legend, 11 200 clout, 28-day streak
    ('funkt4stic', 'first_hundred',        '2025-02-11 10:00:00+00'::timestamptz),
    ('funkt4stic', 'first_project',        '2025-02-15 19:00:00+00'::timestamptz),
    ('funkt4stic', 'five_frontend',        '2025-03-05 12:00:00+00'::timestamptz),
    ('funkt4stic', 'seven_day_streak',     '2025-03-10 08:00:00+00'::timestamptz),
    ('funkt4stic', 'thousand_clout',       '2025-03-22 15:30:00+00'::timestamptz),
    ('funkt4stic', 'five_thousand_clout',  '2025-05-01 09:00:00+00'::timestamptz),
    ('funkt4stic', 'ten_thousand_clout',   '2025-06-02 14:00:00+00'::timestamptz),

    -- nacicaba: legend, 10 800 clout, 62-day streak — most dedicated
    ('nacicaba',   'first_hundred',        '2025-02-09 08:00:00+00'::timestamptz),
    ('nacicaba',   'first_project',        '2025-02-11 20:00:00+00'::timestamptz),
    ('nacicaba',   'complete_profile',     '2025-02-11 20:06:00+00'::timestamptz),
    ('nacicaba',   'five_backend',         '2025-03-01 10:00:00+00'::timestamptz),
    ('nacicaba',   'seven_day_streak',     '2025-02-18 08:00:00+00'::timestamptz),
    ('nacicaba',   'thirty_day_streak',    '2025-03-11 08:00:00+00'::timestamptz),
    ('nacicaba',   'thousand_clout',       '2025-02-28 17:00:00+00'::timestamptz),
    ('nacicaba',   'five_thousand_clout',  '2025-04-15 13:00:00+00'::timestamptz),
    ('nacicaba',   'ten_thousand_clout',   '2025-05-20 11:30:00+00'::timestamptz),

    -- jamesch94: influencer, 4 500 clout, 14-day streak
    ('jamesch94',  'first_hundred',        '2025-02-14 13:00:00+00'::timestamptz),
    ('jamesch94',  'first_project',        '2025-02-20 16:00:00+00'::timestamptz),
    ('jamesch94',  'seven_day_streak',     '2025-05-10 08:00:00+00'::timestamptz),
    ('jamesch94',  'thousand_clout',       '2025-05-25 14:00:00+00'::timestamptz),

    -- honlahaka: influencer, 2 800 clout, 7-day streak
    ('honlahaka',  'first_hundred',        '2025-02-18 09:30:00+00'::timestamptz),
    ('honlahaka',  'first_project',        '2025-03-02 11:00:00+00'::timestamptz),
    ('honlahaka',  'seven_day_streak',     '2025-06-23 08:00:00+00'::timestamptz),
    ('honlahaka',  'thousand_clout',       '2025-06-10 15:00:00+00'::timestamptz),

    -- dragonpup: contributor, 850 clout, 3-day streak — newer user
    ('dragonpup',  'first_hundred',        '2025-03-15 10:00:00+00'::timestamptz),
    ('dragonpup',  'first_project',        '2025-03-20 18:30:00+00'::timestamptz),

    -- dylangorrah: legend, 99 999 clout — seeded admin account
    ('dylangorrah','first_hundred',        '2025-02-08 12:00:00+00'::timestamptz),
    ('dylangorrah','thousand_clout',       '2025-02-08 12:01:00+00'::timestamptz),
    ('dylangorrah','five_thousand_clout',  '2025-02-08 12:02:00+00'::timestamptz),
    ('dylangorrah','ten_thousand_clout',   '2025-02-08 12:03:00+00'::timestamptz)
)
INSERT INTO user_badges (user_id, badge_id, unlocked_at)
SELECT u.id, b.id, a.unlocked_at
FROM assignments a
JOIN user_ids  u ON u.username    = a.username
JOIN badge_ids b ON b.requirement = a.requirement
ON CONFLICT DO NOTHING;


-- ── 2. Seed clout_transactions for history / future activity log ──────────────
INSERT INTO clout_transactions (id, user_id, action_type, clout_amount, created_at)
SELECT
  gen_random_uuid(),
  p.id,
  t.action_type,
  t.clout_amount,
  t.created_at::timestamptz
FROM (VALUES
  -- kestrel
  ('kestrel', 'create_post',    15, '2025-02-12 14:30:00+00'),
  ('kestrel', 'join_room',       2, '2025-02-12 15:00:00+00'),
  ('kestrel', 'follow_gained',   1, '2025-02-14 10:00:00+00'),
  ('kestrel', 'streak_bonus',   25, '2025-02-19 08:00:00+00'),
  ('kestrel', 'create_post',    15, '2025-02-28 09:00:00+00'),
  ('kestrel', 'thousand_clout_milestone', 0, '2025-03-01 11:00:00+00'),
  ('kestrel', 'post_upvoted',    3, '2025-03-05 11:30:00+00'),
  ('kestrel', 'create_comment',  5, '2025-03-18 14:00:00+00'),
  ('kestrel', 'streak_bonus',  100, '2025-03-14 08:00:00+00'),
  ('kestrel', 'post_upvoted',    3, '2025-04-10 16:00:00+00'),
  ('kestrel', 'create_post',    15, '2025-05-02 10:00:00+00'),
  ('kestrel', 'create_comment',  5, '2025-05-15 09:00:00+00'),

  -- funkt4stic
  ('funkt4stic', 'create_post',    15, '2025-02-15 19:00:00+00'),
  ('funkt4stic', 'join_room',       2, '2025-02-16 09:00:00+00'),
  ('funkt4stic', 'create_comment',  5, '2025-02-22 20:00:00+00'),
  ('funkt4stic', 'post_upvoted',    3, '2025-03-01 12:00:00+00'),
  ('funkt4stic', 'streak_bonus',   25, '2025-03-10 08:00:00+00'),
  ('funkt4stic', 'follow_gained',   1, '2025-03-15 14:00:00+00'),
  ('funkt4stic', 'create_post',    15, '2025-04-08 11:00:00+00'),
  ('funkt4stic', 'post_upvoted',    3, '2025-04-20 17:00:00+00'),
  ('funkt4stic', 'create_comment',  5, '2025-05-12 10:30:00+00'),
  ('funkt4stic', 'follow_gained',   1, '2025-06-01 08:00:00+00'),

  -- nacicaba
  ('nacicaba', 'create_post',    15, '2025-02-11 20:00:00+00'),
  ('nacicaba', 'join_room',       2, '2025-02-12 08:30:00+00'),
  ('nacicaba', 'streak_bonus',   25, '2025-02-18 08:00:00+00'),
  ('nacicaba', 'create_comment',  5, '2025-02-25 19:00:00+00'),
  ('nacicaba', 'follow_gained',   1, '2025-03-01 10:00:00+00'),
  ('nacicaba', 'streak_bonus',  100, '2025-03-11 08:00:00+00'),
  ('nacicaba', 'post_upvoted',    3, '2025-03-22 15:00:00+00'),
  ('nacicaba', 'create_post',    15, '2025-04-05 09:00:00+00'),
  ('nacicaba', 'follow_gained',   1, '2025-04-12 11:00:00+00'),
  ('nacicaba', 'create_comment',  5, '2025-04-28 21:00:00+00'),
  ('nacicaba', 'post_upvoted',    3, '2025-05-10 13:00:00+00'),
  ('nacicaba', 'create_comment',  5, '2025-06-05 17:00:00+00'),

  -- jamesch94
  ('jamesch94', 'create_post',    15, '2025-02-20 16:00:00+00'),
  ('jamesch94', 'join_room',       2, '2025-02-21 09:00:00+00'),
  ('jamesch94', 'create_comment',  5, '2025-03-10 14:00:00+00'),
  ('jamesch94', 'post_upvoted',    3, '2025-04-15 11:00:00+00'),
  ('jamesch94', 'streak_bonus',   25, '2025-05-10 08:00:00+00'),
  ('jamesch94', 'follow_gained',   1, '2025-05-18 16:00:00+00'),
  ('jamesch94', 'create_comment',  5, '2025-06-02 10:00:00+00'),
  ('jamesch94', 'post_upvoted',    3, '2025-06-20 14:00:00+00'),

  -- honlahaka
  ('honlahaka', 'create_post',    15, '2025-03-02 11:00:00+00'),
  ('honlahaka', 'join_room',       2, '2025-03-03 08:00:00+00'),
  ('honlahaka', 'create_comment',  5, '2025-04-10 19:30:00+00'),
  ('honlahaka', 'post_upvoted',    3, '2025-05-20 14:00:00+00'),
  ('honlahaka', 'create_post',    15, '2025-06-01 10:00:00+00'),
  ('honlahaka', 'create_comment',  5, '2025-06-15 09:00:00+00'),
  ('honlahaka', 'streak_bonus',   25, '2025-06-23 08:00:00+00'),

  -- dragonpup
  ('dragonpup', 'create_post',    15, '2025-03-20 18:30:00+00'),
  ('dragonpup', 'join_room',       2, '2025-03-21 09:00:00+00'),
  ('dragonpup', 'create_comment',  5, '2025-04-05 14:00:00+00'),
  ('dragonpup', 'post_upvoted',    3, '2025-05-15 11:00:00+00'),
  ('dragonpup', 'follow_gained',   1, '2025-06-10 16:00:00+00'),
  ('dragonpup', 'create_comment',  5, '2025-06-25 20:00:00+00')
) AS t(username, action_type, clout_amount, created_at)
JOIN profiles p ON p.username = t.username;
