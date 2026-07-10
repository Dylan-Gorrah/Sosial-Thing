# Deploying Sideyard — your options, in plain English

This is the how-to for taking Sideyard (the Next.js + Supabase app that lives in
this `sodev/` folder) from your laptop to a real website people can visit.

The short version: **your backend is already live** (Supabase runs it in the
cloud). What's left is putting the *frontend* somewhere on the internet and
pointing a domain at it. That's the whole job.

---

## The 30-second answer

Use **Vercel**. It's made by the same team as Next.js, the free tier is enough
to launch, and it's about 15 minutes of clicking. Jump to
[Option A](#option-a--vercel-recommended) and follow the steps.

Everything else in this doc is context and alternatives.

---

## "Why not just GitHub Pages + a Namecheap domain?"

Fair question — that's the classic cheap-launch recipe. Here's why it doesn't
fit Sideyard:

**GitHub Pages only serves static files.** It's a folder of unchanging HTML —
great for a portfolio, useless for an app. Sideyard is a running program:
when someone opens a post, the server builds that page live — checks the
login cookie, fetches the post, generates the OG share card that makes links
look good in WhatsApp. Login, server actions, per-post share cards, the mod
queue — all of it needs a server. GitHub Pages doesn't have one.

Forcing it in would mean rewriting the app as a static site and **losing
share cards and server-side auth** — a downgrade that costs days of work to
save R0, because:

**Vercel is the same recipe, same price, with a server.**

| | GitHub Pages | Vercel |
|---|---|---|
| Push to GitHub → live | yes | yes |
| Runs Next.js server code | **no** | yes |
| Custom Namecheap domain | yes | yes |
| Auto-deploy on every push | yes | yes |
| Cost | R0 | R0 |

So your plan survives intact — push to GitHub, connect the host, add the
domain, boom. Just swap the word "Pages" for "Vercel". The Namecheap domain
(~R150–300/yr) is optional and can be added any time later without
redeploying; launch day can be R0 on `sideyard.vercel.app`.

---

## First, understand the two halves

Sideyard is two pieces that live in different places:

| Piece | What it is | Where it lives |
|-------|-----------|----------------|
| **Frontend** | The Next.js app in `sodev/` — pages, buttons, the UI | Needs a host. This is what we're deploying. |
| **Backend** | Supabase — your database, logins, image storage | Already hosted by Supabase in the cloud. Nothing to deploy. |

So "deploying" = getting the frontend online and telling it how to reach the
backend. The backend just needs a couple of settings flipped for production
(covered below).

You only need **two secrets** to connect them, both already in your
`.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

(Both are safe to expose to the browser — that's what `NEXT_PUBLIC` means. The
real security is the RLS rules in the database, not hiding these.)

---

## Before you deploy anywhere — the pre-flight checklist

Do these once, no matter which host you pick:

- [ ] **The build passes.** Run `npm run build` in `sodev/`. It should finish
      with no errors. (As of last check: it does.)
- [ ] **Your code is on GitHub.** Vercel and Netlify deploy *from* a GitHub repo.
      If `sodev/` isn't pushed to GitHub yet, that's step zero — create a repo and
      push. (There's a big pile of uncommitted work right now; commit it first.)
- [ ] **You have your two Supabase values handy.** Grab them from the Supabase
      dashboard → Project Settings → API, or copy them out of `.env.local`.

---

## Option A — Vercel (recommended)

**Best for:** you, right now. Zero-config for Next.js, generous free tier,
fastest path to live.

**Cost:** Free (the "Hobby" plan) is fine for launch and the hackathon. You'd
only pay ($20/mo "Pro") if traffic gets big or you want a team.

### Steps

1. Push `sodev/` to a **GitHub** repo if you haven't.
2. Go to **vercel.com** and sign up with your GitHub account.
3. Click **Add New → Project**, and **Import** your Sideyard repo.
4. Vercel auto-detects Next.js — you don't need to touch the build settings.
   - If the repo root isn't the Next app (e.g. the app is in a `sodev/`
     subfolder), set **Root Directory** to `sodev`.
5. Before you click Deploy, open **Environment Variables** and add the two:
   - `NEXT_PUBLIC_SUPABASE_URL` = *(your value)*
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = *(your value)*
6. Click **Deploy**. Wait ~2 minutes.
7. You get a live URL like `sideyard.vercel.app`. Open it — you're online.

From now on, **every push to your main branch auto-deploys.** No more manual
steps. Push code, it goes live.

### Adding your real domain later

When you buy `sideyard.com` (or `.dev`, `.app`, whatever):
- Vercel → your project → **Settings → Domains → Add**, type the domain.
- Vercel shows you the DNS records to paste into wherever you bought the domain
  (Namecheap, Cloudflare, Google Domains, etc.).
- HTTPS is automatic and free. Done.

---

## Option B — Netlify

**Best for:** if you already use Netlify or prefer its dashboard. Basically the
same experience as Vercel.

**Cost:** Free tier is fine to launch.

### Steps
1. Push to GitHub.
2. **netlify.com** → sign up with GitHub → **Add new site → Import an existing
   project**.
3. Pick the repo. Build command `npm run build`, publish handled by the Next.js
   plugin (Netlify installs it automatically for Next apps).
4. Add the same two environment variables.
5. Deploy. You get a `something.netlify.app` URL; add a custom domain the same
   way as Vercel.

Honest take: for a Next.js app there's no reason to pick Netlify over Vercel
unless you have a specific attachment to it. Both are free and easy.

---

## Option C — Cloudflare Pages / Railway / Render / a VPS

**Best for:** later, or specific needs. Skip for launch.

- **Cloudflare Pages** — cheap and fast, but Next.js on Cloudflare has more
  edge-case gotchas. Not worth the debugging right before an event.
- **Railway / Render** — run the app as a normal Node server (`npm run build`
  then `npm run start`). Fine, but you're paying for an always-on server you
  don't need yet.
- **Your own VPS (a DigitalOcean box, etc.)** — most control, most work: you
  manage the server, Node, a reverse proxy, HTTPS certs, restarts. Only makes
  sense much later if you outgrow the managed hosts.

For a launch and a hackathon, none of these beat Vercel. File them under
"someday."

---

## The Supabase side — don't forget this

The database is already live, but a few **production settings** need flipping or
your logins will break on the real domain. Do these in the Supabase dashboard
**after** you know your live URL:

- [ ] **Auth → URL Configuration → Site URL** — set it to your live URL
      (e.g. `https://sideyard.vercel.app`, or your real domain).
- [ ] **Auth → Redirect URLs** — add the same URL (and the real domain once you
      have it). If this is wrong, email confirmation and password-reset links
      bounce users to the wrong place.
- [ ] **Turn on captcha / bot protection** (Auth settings) — matters a lot once
      a paying crowd can sign up. This is a dashboard toggle, not code.
- [ ] **Turn on leaked-password protection** (Auth settings) — free, one click.

These are the "launch-day manual steps" the project docs keep referring to —
now you know exactly what they are.

---

## The launch-day order of operations

When you're actually ready to open the doors:

1. Commit and push all code to GitHub.
2. Deploy to Vercel (Option A) — get your live URL.
3. Set the Supabase Auth Site URL + Redirect URLs to that live URL.
4. Turn on captcha + leaked-password protection.
5. **Run the demo-data cleanup** (`supabase/cleanup_demo.sql`) — wipes the fake
   test users so real people don't land on a feed full of bots.
   *(Heads up: this script hasn't been written yet — it's on the to-do list.)*
6. Do a real signup + post + vote on the live site yourself, on your phone, to
   confirm it all works end to end.
7. Share the link.

---

## Quick cost summary

| Thing | Cost to launch |
|-------|---------------|
| Vercel (frontend hosting) | Free |
| Supabase (backend) | Free tier, until you have real scale |
| A domain name (`sideyard.xyz` etc.) | ~$10–15/year, optional at first |
| **Total to get online** | **$0** (you can launch on the free `.vercel.app` URL) |

You can go fully live for free and only spend money when you want a custom
domain. There's no reason to wait on hosting cost.

---

*Written for Dylan. If any step here fights you, come back and I'll walk through
it live.*
