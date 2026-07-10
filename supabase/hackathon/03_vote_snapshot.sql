-- ═══════════════════════════════════════════════════════════════════════════
-- HACKATHON KIT 3 of 3 — the Sunday-midnight scoring query.
--
-- Counts the upvotes on every entry in the Hackathon room and ranks them.
-- This is READ-ONLY — run it as many times as you like, it changes nothing.
--
-- THE ANTI-CHEAT RULE: only votes from accounts that existed BEFORE the
-- entry deadline count. Someone spinning up 20 fresh accounts on voting
-- weekend gets exactly zero extra votes from them.
--
-- BEFORE RUNNING: edit the two dates in the "params" block below.
--   entry_deadline — when entries closed (usually Friday). Accounts made
--                    after this moment can't influence the result, and
--                    posts made after it aren't entries.
--   voting_ends    — when voting closes (usually Sunday midnight). Votes
--                    arriving later don't count... votes have no timestamp
--                    per-change, so in practice: run this AT the deadline,
--                    and the snapshot IS the result. Save the output.
-- ═══════════════════════════════════════════════════════════════════════════

with params as (
  select
    '2026-08-14 23:59:59+02'::timestamptz as entry_deadline,  -- EDIT ME (Friday)
    '2026-08-16 23:59:59+02'::timestamptz as voting_ends      -- EDIT ME (Sunday)
),

-- Entries: showcase posts in the Hackathon room, posted before the deadline,
-- not removed by moderation
entries as (
  select p.id, p.title, p.user_id, p.created_at
  from public.posts p
  join public.rooms r on r.id = p.room_id
  cross join params
  where lower(r.name) = 'hackathon'
    and p.format = 'showcase'
    and p.created_at <= params.entry_deadline
    and p.removed_at is null
),

-- Countable votes: upvotes (rating 5) from accounts created before the entry
-- deadline. Self-votes are already impossible (the vote function blocks them).
countable_votes as (
  select pr.post_id
  from public.post_ratings pr
  join public.profiles voter on voter.id = pr.user_id
  cross join params
  where pr.rating = 5
    and voter.created_at <= params.entry_deadline
)

select
  rank() over (order by count(cv.post_id) desc, e.created_at asc) as place,
  e.title,
  author.username                                                 as author,
  count(cv.post_id)                                               as votes,
  '/post/' || e.id                                                as link
from entries e
join public.profiles author on author.id = e.user_id
left join countable_votes cv on cv.post_id = e.id
group by e.id, e.title, e.created_at, author.username
order by place;

-- Ties break by who posted first (earlier entry wins the tie — rewarding the
-- person who shipped sooner). If you'd rather break ties another way, that's
-- the "e.created_at asc" in the rank() line.
