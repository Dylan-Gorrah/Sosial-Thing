-- ═══════════════════════════════════════════════════════════════════════════
-- HACKATHON KIT 1 of 3 — the prize badges.
--
-- Creates two badges: Champion (the winner) and Finalist (top entries).
-- Run this any time before the event — creating them doesn't award them.
-- Safe to run twice (the conflict clause makes a second run do nothing).
--
-- AWARDING (after the winner is decided — see 03_vote_snapshot.sql):
-- uncomment the block at the bottom, fill in the username(s), run it.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.badges (name, description, icon, tier, requirement, rarity)
values
  ('Hackathon Champion', 'Won a Sideyard hackathon', '🏆', 'legendary', 'hackathon_champion', 'legendary'),
  ('Hackathon Finalist', 'Placed in the top entries of a Sideyard hackathon', '🎖️', 'gold', 'hackathon_finalist', 'epic')
on conflict (name) do nothing;

-- ── AWARD THE WINNER (run after judging, one username at a time) ─────────────
-- insert into public.user_badges (user_id, badge_id)
-- select p.id, b.id
-- from public.profiles p, public.badges b
-- where p.username = 'WINNER_USERNAME_HERE'
--   and b.requirement = 'hackathon_champion'
-- on conflict do nothing;

-- ── AWARD FINALISTS (same idea, one per finalist) ────────────────────────────
-- insert into public.user_badges (user_id, badge_id)
-- select p.id, b.id
-- from public.profiles p, public.badges b
-- where p.username = 'FINALIST_USERNAME_HERE'
--   and b.requirement = 'hackathon_finalist'
-- on conflict do nothing;
