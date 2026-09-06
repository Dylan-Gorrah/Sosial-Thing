# Test 1 — consistency audit

**Date:** 6 September 2026
**Against:** the live SosialThing database (`aigzawebapfohpkbxlcp`) + the code on `main`
**Method:** read the code, then *actually ran* things — impersonated real logged-in
users in the database and called the same functions the app calls. Where I say
"confirmed", I broke it on purpose and watched it happen.

> [!note] Everything I changed while testing has been undone.
> Votes, verifications and clout are back to exactly the seeded numbers
> (25 votes, 6 verifications). The one post I removed is restored.

---

## The short version

The **clout economy is genuinely solid** — I tried to farm it and couldn't. The
anti-gaming work paid off.

But **moderation doesn't actually moderate**, and **someone picking a taken
username sees a raw database error**. Those two will hurt you on hackathon day.

Then a handful of smaller things: dead tables, a dead column, a permanently
empty tag rail, and a self-follow hole.

---

## 🔴 Critical — fix before real users

### 1. Removing a post does nothing

`remove_post()` sets `removed_at` on the post. **Nothing ever reads it.**

I searched the whole codebase: `removed_at` appears in exactly one place — the mod
queue, where it's used to grey out a row. The feed, post pages, search, profiles,
rooms and the landing-page counter all ignore it completely.

I tested it properly — removed a post as the admin, then looked:

| After a mod "removes" a post | What actually happens |
|---|---|
| Still in the feed? | **Yes** — every reader still sees it |
| Still in search? | **Yes** — still fully searchable |
| Still counted in landing stats? | **Yes** — post count didn't move |
| Author's clout for it? | **Still credited** — never clawed back |

So a room owner removes something abusive, the mod queue tells them it's handled,
and it is still sitting on the front page. That's worse than having no mod tools,
because it quietly lies to the person doing the moderating.

**Fix:** add `.is("removed_at", null)` to every post-reading query, and the same
condition inside `search_posts` and `get_landing_stats`.

### 2. Taking an existing username shows a raw Postgres error

`register()` never checks whether the username is free. It just calls `signUp()`
and returns whatever error comes back.

I signed up as `kestrel`. This is the literal message a user would see:

```
duplicate key value violates unique constraint "profiles_username_key"
```

Two problems: it's meaningless to a normal person, and it leaks your table and
column names. At a hackathon, with everyone grabbing obvious handles, this will
fire constantly.

> [!check] The good news
> No broken accounts result from it. I checked for orphans — auth users with no
> profile — and there are **none**. The whole thing rolls back cleanly. It's
> purely a message problem, not a data problem.

**Fix:** check the username against `profiles` before calling `signUp` (the same
lookup `login()` already does), and map any leftover `23505` to
"That username's taken."

---

## 🟠 High

### 3. The Explore tag rail is permanently empty

`tags.post_count` **is never updated by anything.** There's no trigger on
`post_tags`, and no code writes it.

Explore asks for tags where `post_count > 0`:

```
actual posts per tag:  career=4, databases=5, rust=3, ui-ux=2, webdev=3
tags.post_count:       career=0, databases=0, rust=0, ui-ux=0, webdev=0
tags Explore will show: NONE
```

So tag discovery on Explore shows nothing, forever, no matter how much people
post. Follower counts on tags *are* maintained by a trigger — post counts were
just missed.

**Fix:** a trigger on `post_tags` insert/delete, mirroring the existing
`update_tag_follow_count`. Backfill once for existing rows.

### 4. You can follow yourself

The `no_self_follow` check constraint **was never actually applied.** The
migration that adds it uses `create table if not exists follows (...)` — but
`follows` already existed from the initial schema, so Postgres skipped the whole
statement, constraints included. The table has **no check constraints at all**.

I inserted a self-follow. It worked, and both counters went up for the same
person:

```
dragonpup before: followers=1, following=4
dragonpup after:  followers=2, following=5
```

It also trips the follow-clout trigger, so it pays a small amount of clout. The
`UNIQUE` constraint limits it to one per account, so it's vanity-metric gaming
rather than a real clout exploit — but follower counts stop meaning anything.

(Deleted again, counts recalculated from source.)

**Fix:** `alter table follows add constraint no_self_follow check (follower_id <> following_id);`
— worth checking for existing self-follows first.

---

## 🟡 Medium

### 5. Slop filtering is applied in some places and not others

A post the community flagged as slop is hidden in some views and visible in
others:

| Where | Filters flagged posts? |
|---|---|
| Feed — Hot | Yes |
| Feed — Rising | Yes |
| Feed — **New** | **No** |
| Feed — **Top** | **No** |
| Explore | Yes (everywhere) |
| **Search** | **No** |

So flagging something removes it from Hot, and it's still sitting on New. Whether
that's a bug depends on intent — but right now it's *accidental*, not chosen.

Worth deciding deliberately: should flagged posts be hidden, or shown with the
slop chip they already have? Either is defensible; the inconsistency isn't.

### 6. `search_posts` filters nothing

The search function returns `slop_status` so the UI *can* show a chip, but it
never excludes removed or flagged posts itself. Same root cause as #1 and #5 —
noting it separately because it's a database function, so it needs its own fix.

---

## 🟢 Low — cleanup, not urgent

- **`saved_posts` is a dead table.** Superseded by `bookmarks`. Zero code
  references anywhere, 0 rows, but it still has RLS policies. Someone will
  eventually wire up the wrong one. Drop it.
- **`posts.view_count` is never incremented.** Nothing writes it; all 19 posts
  sit at 0. Either implement view counting or drop the column.
- **`format = 'poll'` is allowed but doesn't exist.** The CHECK constraint
  permits it, there are no poll tables and no UI. A post created with that format
  through the API would render as nothing.
- **`profiles.email` can drift from `auth.users.email`.** Login resolves
  username → `profiles.email` → sign in. If an auth email ever changes (dashboard
  edit, or OAuth later), that person can't log in any more. **Latent, not live** —
  nothing in the app changes email today, and settings has no email field.

---

## ✅ Verified working — I tried to break these and couldn't

The anti-gaming design holds up. Simulated as a real logged-in user:

| Attack / action | Result |
|---|---|
| Upvote, unvote, upvote again to farm clout | **Blocked** — author paid once, ever |
| Vote on your own post | **Blocked** — "Cannot vote on your own post" |
| Edit someone else's post | **Blocked** — ownership enforced |
| Edit your own post after 24h | **Blocked** — window enforced |
| Verify a post while under 500 clout | **Gate works** |
| Join a room with a junk invite code | **Rejected cleanly** |
| Anon calling mutating RPCs | **Permission denied** (fixed earlier today) |
| Anon reading reports | **Empty, no error** — RLS correct |

Also fine: no orphaned accounts, signup rolls back cleanly on failure, comment
counts match their actual rows, room creation does generate invite codes, and
empty states exist on every main list including rooms.

---

## What I did NOT test

Being straight about the gaps:

- **The browser UI.** Everything here is database and code level. I couldn't
  click through pages — the dev server kept getting killed by low memory
  (0.35 GB free). Visual bugs, mobile layout and client-side crashes are
  unchecked.
- **Concurrency.** No two-people-voting-at-once or race condition testing.
- **Load.** No idea how it behaves with 50 people signing up in the same hour,
  which is exactly what hackathon morning looks like.
- **Email confirmation on signup.** Supabase blocks test domains, so I couldn't
  complete a real signup without emailing a stranger. **Worth you checking
  manually** — if "Confirm email" is on and there's no SMTP configured, the
  built-in mailer allows only a few messages an hour, which would break a
  hackathon signup rush completely.

---

## Suggested order

1. Filter `removed_at` everywhere (#1) — moderation currently doesn't work
2. Friendly username-taken message (#2) — will fire constantly at a hackathon
3. Check the email-confirmation setting yourself — potential signup-day blocker
4. `tags.post_count` trigger (#3)
5. `no_self_follow` constraint (#4)
6. Decide the slop-visibility rule and apply it consistently (#5, #6)
7. Drop the dead table/column/format when convenient
