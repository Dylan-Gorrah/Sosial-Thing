# Hackathon Prep — instructions for Claude Code

> **STATUS (July 10):** Phase 2 items **1 (showcase upgrade)**, **2 (report button)**
> and **3 (rate limiting)** are DONE — showcase via the composer redesign (July 5),
> reports + mod queue and DB rate limits (5 posts/hr, 5 comments/min, 20 reports/hr)
> this session; see `../Brain/Build Log - Reports and Moderation.md`.
> Still open: **4 (demo cleanup script)**, **5 (deploy prep)**, **6 (event kit SQL)**.
> Manual steps for Dylan: Supabase captcha/signup throttling (dashboard), and
> `update profiles set is_admin = true where username = '<you>';`

You're working in the SoDev codebase (Next.js + Supabase). We're prepping the platform to host its first paid hackathon: R25 entry, one-week build, community + judge voting over a weekend, winner takes the pot.

Context lives in two sibling folders — read these first:
- `../Brain/Hackathon Plan.md` — the event plan and rules
- `../Brain/START HERE.md` — project status and build-log index
- `../Analysis/Hackathon Playbook.html` — the full playbook (skim the section headings)

Work through the phases below **in order**. Don't skip Phase 1 — verify before you fix.

---

## Phase 1 — Check first (no changes yet)

1. **Does it build?** Run `npm run build`. Note any errors or warnings.
2. **Security sweep.** Check RLS on every table (all 13+ should have policies). If the Supabase MCP is connected, run the security and performance advisors and note what they say.
3. **Map the demo data.** Find exactly what the demo seeds created (demo users, their posts, votes, clout, badges — see `supabase/migrations/*seed_demo*` and `../Brain/Demo Data.md`). We need a clean removal plan, not a guess.
4. **Confirm the format gaps.** Verify what I found: image galleries only attach when `format === "media"` (`src/app/actions/posts.ts` ~line 81), and video embeds only render when `format === "link"` (`src/components/post/PostPage.tsx` ~line 239). Showcase posts currently get neither.

Write down what you find before moving on.

---

## Phase 2 — Fix, in this priority order

### 1. Showcase upgrade (the big one)
A hackathon entry is a Showcase post. It should be able to carry everything the platform supports, in one post:
- **Images on showcase posts.** The `post_images` table already keys off any post — lift the `format === "media"` gate in the create action and the composer UI so showcase posts can attach a gallery too. Render the gallery on showcase post pages (reuse the media carousel).
- **Video on showcase posts.** `posts.link_url` already exists on every post and the insert already saves it. Add an optional "Demo video URL" field to the showcase composer, and on showcase post pages run `detectEmbed(link_url)` — if it's a YouTube link, render the `VideoPlayer` above the body, same as link posts do.
- No schema changes should be needed. If you find you need one, stop and note why before migrating.

### 2. Report button
There's no way for a regular user to flag a problem — with a paying crowd coming, we need one.
- New `reports` table: target post/comment, reporter, reason (short enum), status, created_at. RLS: users insert their own, only mods/admins read.
- A "Report" option in the post and comment menus.
- A simple queue for mods to see and resolve reports — inside the existing room moderation surface is fine. Minimal is the goal; don't build a whole admin panel.

### 3. Rate limiting (minimal, DB-side)
- Guards in the create actions or DB triggers: cap posts per user per hour and comments per user per minute at sane values. Return a friendly error, not a crash.
- Note in your log that signup throttling/captcha is configured in the Supabase dashboard (Auth settings), not in code — flag it as a manual step for Dylan.

### 4. Demo data cleanup script
- Write `supabase/cleanup_demo.sql`: removes the demo users and everything cascading from them (posts, votes, comments, clout events, badges, follows). Make it idempotent and safe to review before running.
- **Do NOT run it** — Dylan runs it right before launch. Just write and document it.

### 5. Deploy prep
- Make sure `npm run build` passes clean.
- Check `next.config.ts` allows the Supabase storage domain for images.
- List every env var the app needs (from `.env.local`, names only — never write values anywhere).
- Quick mobile pass on the money screens: login/register, feed, post detail, create-post modal. Fix anything broken at ~390px width. Voting weekend happens on phones.

### 6. Hackathon event kit
Create `supabase/hackathon/` with ready-to-run SQL, each file commented in plain English:
- `01_badges.sql` — seed "Hackathon Champion" and "Hackathon Finalist" badges.
- `02_room.sql` — create the hackathon room + event tag.
- `03_vote_snapshot.sql` — the scoring query: upvotes per entry post in the hackathon room, counting **only votes from accounts created before the entry deadline** (use a `:deadline` parameter). This is the Sunday-midnight query.

### What NOT to build (deliberate calls — don't "improve" these)
- **No payment integration.** R25 is collected off-platform (SnapScan/EFT/cash + a tracked sheet).
- **No mandatory-GitHub validation in code.** The GitHub link is required by event rule and checked by hand in the Friday entry sweep. Code for one event's rule isn't worth it yet.
- **No new hackathon tables/features.** The event runs on rooms + tags + showcase posts that already exist.

---

## Phase 3 — Document (required, not optional)

When done, write `../Brain/Build Log - Hackathon Prep.md` in the same style as the other build logs in that folder: **clean conversational English, short, easy to read**. Obsidian formatting (frontmatter tags, `> [!check]` / `> [!warning]` callouts, `[[wikilinks]]`). It must cover:
- What you checked in Phase 1 and what you found
- What you changed, file by file, in plain words (no jargon dumps)
- What you deliberately didn't do, and why
- Manual steps left for Dylan (run cleanup SQL, Supabase captcha, deploy to Vercel, run the event kit SQL)

Also add one checklist line to the status list in `../Brain/START HERE.md` linking the new build log.

Test as you go. If something in this plan turns out to be wrong once you're in the code, use your judgment, fix it the right way, and explain the call in the build log.
