"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ── Icons ─────────────────────────────────────────────────────────────────────
const ShieldIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>;
const TrendIcon  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>;
const RoomsIcon  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
const TrophyIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4"/><path d="M7 4h10v6a5 5 0 0 1-10 0z"/><path d="M7 6H4a1 1 0 0 0-1 1c0 2.5 2 4 4 4"/><path d="M17 6h3a1 1 0 0 1 1 1c0 2.5-2 4-4 4"/></svg>;

// ── Count-up stat ─────────────────────────────────────────────────────────────
function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (value === 0) return;
    const duration = 1100;
    const t0 = performance.now();
    let raf: number;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

// ── Component ─────────────────────────────────────────────────────────────────
export interface LandingStats {
  devs: number;
  posts: number;
  comments: number;
  clout: number;
  verified: number;
}

const FEATURES = [
  {
    icon: <ShieldIcon />,
    color: "#3fb970",
    title: "Peer-verified builds",
    body:  "Other developers vouch that your project is real — they ran the demo, read the code, watched it work. Verified work earns more, and vouching for garbage costs the voucher.",
  },
  {
    icon: <TrendIcon />,
    color: "var(--color-accent)",
    title: "Clout you can't farm",
    body:  "Reputation comes from what others say about your work, not from posting volume. Daily caps, pair-wise limits, and slashing make slop economically worthless.",
  },
  {
    icon: <RoomsIcon />,
    color: "#58a6ff",
    title: "Rooms for your niche",
    body:  "Public or private communities with their own feeds, moderation, and leaderboards. The Reddit half of the pitch, minus the noise.",
  },
  {
    icon: <TrophyIcon />,
    color: "#f59e0b",
    title: "A race that resets weekly",
    body:  "Leaderboards default to this week, so anyone can win by having a good one. Builders, community, streaks — pick your ladder.",
  },
];

export default function Landing({ stats }: { stats: LandingStats }) {
  const STATS = [
    { label: "Developers",       value: stats.devs },
    { label: "Posts shared",     value: stats.posts },
    { label: "Comments",         value: stats.comments },
    { label: "Clout earned",     value: stats.clout },
  ];

  return (
    <div
      className="min-h-screen overflow-y-auto"
      style={{
        background: `
          radial-gradient(110% 70% at 15% 0%, rgba(255,46,126,.16), transparent 55%),
          radial-gradient(110% 90% at 100% 100%, rgba(90,40,120,.22), transparent 60%),
          linear-gradient(160deg,#130a13 0%,#0b0b0d 60%)
        `,
      }}
    >
      {/* grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)",
          backgroundSize: "46px 46px",
          maskImage: "radial-gradient(75% 60% at 50% 0%,#000,transparent)",
        }}
      />

      <div className="relative z-10 mx-auto px-6" style={{ maxWidth: 1020 }}>

        {/* ── Nav ── */}
        <nav className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <div
              className="grid place-items-center rounded-[9px] text-white font-bold text-xl"
              style={{ width: 36, height: 36, background: "linear-gradient(150deg,var(--color-accent),#b3005c)", boxShadow: "0 8px 26px rgba(255,46,126,.35)" }}
            >
              S
            </div>
            <span className="font-semibold text-[17px] tracking-wide" style={{ color: "var(--color-text)" }}>SoDev</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-[8px] rounded-[7px] text-[13px] font-medium transition-colors"
              style={{ color: "var(--color-text-2)", textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"}
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="px-5 py-[8px] rounded-[7px] text-[13px] font-semibold text-white transition-all"
              style={{ background: "var(--color-accent)", textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.filter = "brightness(1.1)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.filter = ""}
            >
              Join SoDev
            </Link>
          </div>
        </nav>

        {/* ── Hero ── */}
        <div className="text-center pt-16 pb-12" style={{ animation: "rise .3s ease both" }}>
          <h1 className="font-light leading-[1.08] m-0 mb-5" style={{ fontSize: "clamp(40px, 7vw, 68px)", letterSpacing: "-.015em", color: "var(--color-text)" }}>
            Where code<br />meets{" "}
            <span
              className="font-semibold"
              style={{ background: "linear-gradient(110deg,#fff,var(--color-accent))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            >
              clout.
            </span>
          </h1>
          <p className="mx-auto font-light leading-relaxed m-0 mb-9" style={{ fontSize: 16.5, color: "var(--color-text-2)", maxWidth: "46ch" }}>
            The developer community where side projects actually matter.
            Post your work, get it verified by real people, earn reputation that can&apos;t be farmed.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="px-8 py-[13px] rounded-[9px] text-[14.5px] font-semibold text-white transition-all"
              style={{ background: "var(--color-accent)", boxShadow: "0 10px 34px rgba(255,46,126,.35)", textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.filter = "brightness(1.1)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.filter = ""}
            >
              Start earning clout
            </Link>
            <Link
              href="/login"
              className="px-8 py-[13px] rounded-[9px] text-[14.5px] font-medium transition-all"
              style={{ color: "var(--color-text-2)", border: "1px solid var(--color-line-2, var(--color-line))", textDecoration: "none" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--color-text-3)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line)"; }}
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* ── Live stats — real numbers, no fakes ── */}
        <div
          className="grid rounded-[14px] overflow-hidden mb-20"
          style={{ gridTemplateColumns: "repeat(4, 1fr)", border: "1px solid var(--color-line)", background: "rgba(255,255,255,.02)", backdropFilter: "blur(6px)" }}
        >
          {STATS.map((s, i) => (
            <div key={s.label} className="flex flex-col items-center gap-[6px] py-7" style={{ borderLeft: i > 0 ? "1px solid var(--color-line)" : "none" }}>
              <span className="font-bold tabular-nums" style={{ fontSize: 30, letterSpacing: "-.02em", color: "var(--color-text)" }}>
                <CountUp value={s.value} />
              </span>
              <span className="uppercase tracking-[.12em]" style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-3)" }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* ── Features ── */}
        <div className="grid gap-4 mb-20" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="p-6 rounded-[14px] transition-all duration-150"
              style={{ background: "rgba(255,255,255,.025)", border: "1px solid var(--color-line)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${typeof f.color === "string" && f.color.startsWith("#") ? f.color + "66" : "var(--color-accent)"}`; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.025)"; }}
            >
              <div
                className="flex items-center justify-center rounded-[10px] mb-4"
                style={{ width: 42, height: 42, color: f.color, background: "rgba(255,255,255,.04)", border: "1px solid var(--color-line)" }}
              >
                {f.icon}
              </div>
              <h3 className="m-0 mb-2 font-semibold" style={{ fontSize: 15.5, color: "var(--color-text)" }}>{f.title}</h3>
              <p className="m-0 leading-[1.65]" style={{ fontSize: 13, color: "var(--color-text-3)" }}>{f.body}</p>
            </div>
          ))}
        </div>

        {/* ── Bottom CTA ── */}
        <div
          className="flex flex-col items-center text-center gap-5 rounded-[16px] px-8 py-12 mb-16"
          style={{
            border: "1px solid var(--color-line)",
            background: "radial-gradient(80% 120% at 50% 0%, rgba(255,46,126,.12), transparent 70%)",
          }}
        >
          <h2 className="font-light m-0" style={{ fontSize: 30, letterSpacing: "-.01em", color: "var(--color-text)" }}>
            The race resets every week.
          </h2>
          <p className="m-0" style={{ fontSize: 14, color: "var(--color-text-2)", maxWidth: "42ch" }}>
            Ship something, get it verified, climb the board. The first 100 developers earn the Pioneer badge — permanently.
          </p>
          <Link
            href="/register"
            className="px-8 py-[13px] rounded-[9px] text-[14.5px] font-semibold text-white transition-all"
            style={{ background: "var(--color-accent)", boxShadow: "0 10px 34px rgba(255,46,126,.3)", textDecoration: "none" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.filter = "brightness(1.1)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.filter = ""}
          >
            Create your account
          </Link>
        </div>

        {/* ── Footer ── */}
        <footer className="flex items-center justify-between pb-10" style={{ borderTop: "1px solid var(--color-line)", paddingTop: 24 }}>
          <span style={{ fontSize: 12, color: "var(--color-text-3)" }}>SoDev — built by developers, for developers.</span>
          <div className="flex gap-5">
            <Link href="/login" style={{ fontSize: 12, color: "var(--color-text-3)", textDecoration: "none" }}>Sign in</Link>
            <Link href="/register" style={{ fontSize: 12, color: "var(--color-text-3)", textDecoration: "none" }}>Register</Link>
          </div>
        </footer>

      </div>
    </div>
  );
}
