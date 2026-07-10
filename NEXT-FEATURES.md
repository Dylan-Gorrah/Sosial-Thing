# Next Features — instructions for Claude Code (round 2)

> **STATUS UPDATE (July 5, later):** Items 1, 3, 4 and 6 are ALREADY IMPLEMENTED
> (by Cowork Claude, directly in the working tree — uncommitted). Do NOT redo them.
> Your jobs now, in order:
> 0. **Verify the new work first**: run `npm run build` and lint — the changes were
>    written without a compiler available. Touched files: `CreateRoomModal.tsx`,
>    `CreatePostModal.tsx` (full content-first rewrite), `posts.ts` (createPost),
>    `PostPage.tsx`, `PostDetail.tsx`, `PostCard.tsx`, `post/[id]/page.tsx`
>    (new generateMetadata), new `shared/ImageCarousel.tsx`, new `shared/DemoPreview.tsx`.
>    Fix any type/lint errors in the spirit of the comments in those files. Test:
>    create posts (text / images / video link / repo+demo / all combined), check the
>    derived-format chip, draft restore, room create with private selected, gallery
>    on /post/[id], demo preview iframe, OG tags in page head.
>    ALSO NEW: `src/app/(app)/explore/page.tsx` + `src/components/explore/ThumbCarousel.tsx`
>    — the Explore page, v3 three-column layout (design notes in `../Brain/Explore Page.md`).
>    Verify it builds and renders logged-out; the Today/Week/All-time toggle works via
>    ?t= param; feed cards show the big right-side thumbnail (gallery image or YouTube
>    frame); multi-image posts get working carousel arrows that do NOT navigate the
>    card link; rails (tags + join CTA left, event/rooms/creators right) show at lg+
>    and hide on mobile; the join CTA only appears logged-out; and the event banner
>    appears when a room named *hackathon* exists.
>    ALSO NEW — EVENTS (design: `../Brain/Events System.md`): posts can be events.
>    Migration `20260705200000_events_on_posts` (is_event, event_starts_at) is ALREADY
>    APPLIED to the live DB and mirrored in supabase/migrations — do not re-apply.
>    Verify: composer "Event" toggle requires a datetime and rejects past dates;
>    EVENT chip shows in the Explore feed and on the post page; Explore's left rail
>    shows upcoming events (joined rooms + followed people + own for logged-in, all
>    public events for logged-out) as poster cards, capped at 4, hidden when none;
>    ThumbCarousel touch-swipe flips images without triggering the card link.
> 1. Then build item **2 (report system with room routing)** below.
> 2. Then item **5 (project posts)** below.
> 3. Small cleanup: `PostDetail.tsx` still has a local ImageCarousel copy — switch it
>    to the shared `@/components/shared/ImageCarousel` and delete the local one.
> 4. Commit as you go, then write the build log (Phase 3).

Follow-up to HACKATHON-PREP.md. Same rules: verify before fixing, test as you go, and when done write a conversational build log in `../Brain/` (see Phase 3 at the bottom). Priorities are in order — a bug fix first, then the sharing loop, then the bigger builds.

---

## 1. BUG: room visibility selector looks dead

In `src/components/rooms/CreateRoomModal.tsx` (~line 71): the public/private radios are `sr-only` and the selected state relies on the Tailwind `has-[:checked]:border-...` class — but the label also has an inline `style={{ border: "1px solid var(--color-line)" }}`. **Inline styles beat classes**, so the highlight never shows and the selector looks broken even though the radio may actually change underneath.

Fix the selected-state styling (drop the inline border in favor of classes, or drive it from React state), verify both options visibly select, and confirm a room actually saves as private end-to-end. Check the codebase for the same inline-style-vs-`has-[:checked]` pattern elsewhere — if the composer or settings use it too, fix those while you're in there.

## 2. Report system with room routing

Builds on the report button planned in HACKATHON-PREP.md, with one key routing rule:

- `reports` table: id, post_id / comment_id (one of), reporter_id, reason (short enum: spam, abuse, stolen work, other + optional note), status (open / resolved / dismissed), resolved_by, created_at.
- **Routing:** if the reported post lives in a room → the report belongs to that room, and the room owner + mods see it. If the post has no room → it goes to the site admin (Dylan).
- **The inbox:** room owners/mods get a notification ("1 new report in <room>") and a review queue on the room's moderation surface — report reason, link to the post, resolve/dismiss buttons, and the existing remove/ban actions right there. Quick review is the whole point: see it, judge it, act, done.
- Report option goes in the post/comment ⋯ menu.
- RLS: reporters insert their own; only the room's owner/mods (or admin for roomless posts) can read/resolve. Route resolution through a SECURITY DEFINER RPC like the other moderation functions.

## 3. Share + link unfurling (small, do together)

- **Share button** in the post action row (next to Save/Verify): copies the post URL, uses `navigator.share` on mobile when available. Tiny "copied" confirmation.
- **OG meta tags** on the post page (`generateMetadata` in the post route): title, author, description from the body's first lines, first post image (or a default card) as `og:image`, plus twitter card tags. Test by checking what the rendered `<head>` contains for a text post, an image post, and a showcase post.

This pair is the distribution loop for the hackathon — links shared into WhatsApp/Discord must look good and be one tap to make.

## 4. Live demo previews (GitHub Pages etc. render as a website view)

Showcase posts have a `demo_url`. When it points at a live site, show the site, not just a button:

- In the post view, render a **click-to-load embedded preview** of `demo_url` — a facade (screenshot-style placeholder or simple "▶ Load live demo" card) that swaps in a sandboxed `<iframe>` on click, same pattern as the existing YouTube facade player.
- **Security is non-negotiable:** `sandbox` attribute (allow-scripts allow-same-origin at most, no top-navigation, no popups... reason about the minimal set), https-only, and start with an **allowlist of trusted hosts**: `*.github.io`, `*.vercel.app`, `*.netlify.app`, `*.pages.dev`. Anything else keeps the current button. Note: many sites send `X-Frame-Options`/CSP that blocks framing — detect the iframe failing to load and fall back to the button gracefully.
- Keep the existing repo/demo buttons regardless; the preview is an addition, not a replacement.

## 5. Project posts (new feature — design carefully)

A post type for ongoing work: the author keeps adding to it over time, like a devlog.

- **Model:** `project_updates` table — id, post_id, body_md, created_at (+ optional images reusing `post_images` with an update_id, if that's clean; else keep updates text+markdown only for v1). A post becomes a project via a flag (`is_project` on posts) — settable at creation ("Post a project") or later from the ⋯ menu ("Convert to project"), owner-only.
- **Rendering:** the original post stays on top; updates render below it as a timestamped timeline ("Update · 3 days ago"), newest last (a story reads downward). A "PROJECT" chip on the post card in feeds, and show update count.
- **Adding updates:** owner-only "Add update" on the post page. Markdown, same editor feel as comments. Route through a SECURITY DEFINER RPC or a properly-policied insert.
- **Notifications:** followers of the post get "project you follow was updated" — build the minimal follow-post mechanism for this (a `post_follows` table + notification trigger). Author's own post is auto-followed by people who commented? No — keep v1 simple: explicit follow button on the post.
- **Anti-gaming (important):** an update must NOT freely re-bump the post in feeds. At most: one bump per 24h into the New feed, and updates award zero clout. Otherwise update-spam becomes free front-page space and a clout printer — the exact economy problem we just locked down.

## 6. Composer flow revision (make posting feel obvious)

The composer currently opens on five format tabs (text / link / media / poll / showcase) and each format is exclusive. Review it with fresh eyes and make it more intuitive. Direction to explore:

- **Content-first, not format-first:** default view = title + body, with attach actions (add images, add a link/video, add repo + demo) instead of making the user pick a category upfront. If full merging is too big a change, at minimum: reorder tabs by real-world use (Showcase and Text first), make the format labels self-explanatory ("Showcase — show off a project"), and carry the user's title/body across tab switches (losing typed text when switching tabs is rage-inducing — verify whether that happens and fix it if so).
- **Poll check:** the `poll` format is in the type union — if there's no working poll UI/tables behind it, hide the option. Dead-end options are worse than missing ones (same rule as private rooms).
- **Draft safety:** persist composer state to localStorage so an accidental close doesn't eat a half-written post. Cheap and loved.
- Use your judgment on what's worth doing now vs. noting for later — write the reasoning in the build log.

## What NOT to do

- No awards/tipping, no reposts, no emoji reactions (all reopen problems we've deliberately closed — see `../Brain/Feature Ideas.md`).
- No payment code. No new gamification. Nothing that awards clout from new paths without the existing caps.
- Don't run the demo-data cleanup — that stays a launch-day step for Dylan.
- **Commit as you go** — one commit per numbered item, clear messages. The uncommitted-work pile must not grow again.

## Phase 3 — document (required)

When done: write `../Brain/Build Log - Reports Sharing Projects.md` in the same conversational style as the other build logs (frontmatter tags, callouts, wikilinks, plain English). Cover what you checked, what you built per item, the calls you made and why, and anything left for later. Add a checklist line to `../Brain/START HERE.md`, and update the new "Post actions" / "Project posts" entries in `../Brain/Feature Ideas.md` from 🟡/🟢 to done-with-a-link where they shipped.
