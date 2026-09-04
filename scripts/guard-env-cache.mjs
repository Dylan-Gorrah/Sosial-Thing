// ============================================================================
// Clears the Next build cache when NEXT_PUBLIC_* values change.
// ----------------------------------------------------------------------------
// Why this exists: Next inlines NEXT_PUBLIC_* variables into the CLIENT bundle
// at compile time. Turbopack's cache in .next survives a dev-server restart, so
// editing .env.local and restarting is NOT enough — the browser keeps getting
// chunks with the old values baked in.
//
// This bit us moving to the new Supabase project (Sept 2026). Server actions
// picked up the new URL immediately, so logging in worked, while every
// client-side query still pointed at the old dead project. The feed just
// rendered empty — no error anywhere, because the requests were "fine", they
// were simply going to a database that no longer existed. That is the worst
// kind of bug: silent, and it looks like your code is broken.
//
// So: fingerprint the NEXT_PUBLIC_* values, and if they moved since the last
// run, delete .next. Only fires on an actual change, so normal startups stay
// fast — there is no reason to pay a full recompile when nothing moved.
// ============================================================================

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// The fingerprint lives OUTSIDE .next on purpose — we delete .next, so anything
// stored in there would vanish with it and we would clear the cache every run.
const stampFile = join(root, "node_modules", ".cache", "sodev-env-fingerprint");
const nextDir   = join(root, ".next");

// Later files win, matching Next's own precedence.
const envFiles = [".env", ".env.local", ".env.development", ".env.development.local"];

const publicVars = new Map();
for (const name of envFiles) {
  const path = join(root, name);
  if (!existsSync(path)) continue;

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (!key.startsWith("NEXT_PUBLIC_")) continue;   // only these reach the browser

    // Strip surrounding quotes so NEXT_PUBLIC_X=a and NEXT_PUBLIC_X="a" match
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    publicVars.set(key, value);
  }
}

if (publicVars.size === 0) process.exit(0);   // nothing public to guard

const fingerprint = createHash("sha256")
  .update([...publicVars.entries()].sort().map(([k, v]) => `${k}=${v}`).join("\n"))
  .digest("hex");

const previous = existsSync(stampFile) ? readFileSync(stampFile, "utf8").trim() : null;

const changed = previous && previous !== fingerprint;

if (changed && existsSync(nextDir)) {
  console.log("\n  NEXT_PUBLIC_* values changed since the last run.");
  console.log("  Clearing .next so the client bundle is rebuilt with the new values.");
  console.log("  (Without this the browser keeps the OLD values baked in.)\n");

  try {
    // Windows locks files that a running dev server still holds, which throws
    // ENOTEMPTY. Retries cover the usual case of a process shutting down.
    rmSync(nextDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (err) {
    // Never take the dev server down over this — a hard failure here would
    // block startup entirely, which is worse than the problem being solved.
    // But do NOT stamp the new fingerprint: leaving it stale means the next
    // run tries again, instead of assuming a clear that never happened.
    console.error("  Could not delete .next automatically:", err.code ?? err.message);
    console.error("  Another process is probably holding it open.");
    console.error("  Stop every dev server and run:  npm run dev:clean\n");
    process.exit(0);
  }
}

mkdirSync(dirname(stampFile), { recursive: true });
writeFileSync(stampFile, fingerprint);
