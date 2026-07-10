# SoDev — repo instructions

Social platform for creators (dev-first, built to branch into art/3D/etc).
Next.js 16 + Tailwind, Supabase (Postgres/auth/storage). Planning brain and
build history live in `../Brain/` — read `START HERE.md` if you need context.

## Before anything else

1. Read `NEXT-FEATURES.md` (and `HACKATHON-PREP.md`) — the handoff briefs.
   Work marked DONE is done; don't redo it. Update the status header when you
   finish an item.
2. Run `npm run build` before and after changes. Never hand back unverified
   work — if you can't verify something, flag it loudly in the brief.

## Architecture rules

- **All guarded writes go through SECURITY DEFINER RPCs** (`vote_post`,
  `edit_post`, `join_room_by_code`, moderation functions). Never add direct
  client writes to protected tables; never add permissive RLS policies to
  make something "work". The security lockdown migration
  (`20260705120000`) is deliberate — do not loosen it.
- **The clout economy is sealed.** No new code paths that award clout without
  the existing caps; nothing that lets users transfer value (tips, awards).
  Anti-gaming beats features here, always.
- **Posts are content-first.** Format (`text/link/media/showcase`) is DERIVED
  from attachments, never user-picked. Any post can carry images, a video
  link, repo/demo links. Events are posts (`is_event` + `event_starts_at`),
  projects will be posts — don't build parallel content systems.
- **Migrations:** every schema change is a file in `supabase/migrations/`
  AND applied to the live project — keep them in sync. Additive migrations
  only while pre-launch; check `get_advisors` after DDL.

## Conventions

- Server components by default; small client islands (`"use client"`) only
  where interactivity demands it (see `ThumbCarousel`, `CreatePostModal`).
- Styling: Tailwind classes + inline styles with CSS variables
  (`var(--color-*)`). Match the existing dark look; don't introduce new
  color systems.
- Empty states are required for every list/feed. Fallback to newest content
  or hide the section — a blank pane reads as broken.
- Mobile pass on anything user-facing (~390px). Rails hide, thumbs stack.
- One commit per feature, clear message. Uncommitted piles are forbidden.

## Launch-day manual steps (do NOT automate or run early)

- `supabase/cleanup_demo.sql` — Dylan runs this right before launch.
- Supabase Auth: production Site URL + redirect URLs, captcha, leaked-password
  protection — dashboard settings, flagged in the briefs.

## After the work

Write `../Brain/Build Log - <Thing>.md` (conversational English, short,
Obsidian callouts + wikilinks, same voice as existing logs) and add a
checklist line to `../Brain/START HERE.md`.
