"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { CloutTier } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────
type Category = "clout" | "builders" | "community" | "streaks";
type Window   = 7 | 30 | 0;

interface BoardRow {
  rank: number;
  prev_rank: number | null;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  clout_tier: CloutTier;
  total: number;
  verified_posts: number;
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const TrophyIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4"/><path d="M7 4h10v6a5 5 0 0 1-10 0z"/><path d="M7 6H4a1 1 0 0 0-1 1c0 2.5 2 4 4 4"/><path d="M17 6h3a1 1 0 0 1 1 1c0 2.5-2 4-4 4"/></svg>;
const FlameIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14c0-4 3.5-5 3.5-9 2 1.5 4 4.5 4 7.5a7 7 0 0 1-14 0c0-2 1-4 2.5-5.5-.5 2 1 4.5 4 7z"/></svg>;
const UpIcon     = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>;
const DownIcon   = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>;
const CheckIcon  = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 12 10 18 20 6"/></svg>;
const EmptyIcon  = () => <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4"/><path d="M7 4h10v6a5 5 0 0 1-10 0z"/></svg>;

// ── Helpers ───────────────────────────────────────────────────────────────────
function avatarGrad(tier: CloutTier): string {
  switch (tier) {
    case "legend":      return "linear-gradient(150deg,var(--color-accent),#b3005c)";
    case "influencer":  return "linear-gradient(150deg,#a371f7,#6e40c9)";
    case "contributor": return "linear-gradient(150deg,#58a6ff,#1a7fd4)";
    default:            return "linear-gradient(150deg,#3a3a4a,#1e1e28)";
  }
}

function tierStyle(tier: CloutTier): React.CSSProperties {
  switch (tier) {
    case "legend":      return { background: "var(--color-accent)", color: "#fff" };
    case "influencer":  return { background: "rgba(163,113,247,.2)", color: "#a371f7" };
    case "contributor": return { background: "rgba(56,139,253,.2)",  color: "#58a6ff" };
    default:            return { background: "rgba(255,255,255,.07)", color: "var(--color-text-3)" };
  }
}

function rankColor(rank: number): string {
  if (rank === 1) return "#f59e0b";
  if (rank === 2) return "#a8a9ad";
  if (rank === 3) return "#cd7f32";
  return "var(--color-text-3)";
}

const CATEGORIES: { value: Category; label: string; hint: string }[] = [
  { value: "clout",     label: "Clout",     hint: "All clout earned — the headline race" },
  { value: "builders",  label: "Builders",  hint: "Posting, upvotes received, verified builds, posts that held up" },
  { value: "community", label: "Community", hint: "Comments, comment likes, verifying and curating" },
  { value: "streaks",   label: "Streaks",   hint: "Longest current daily streaks" },
];

const WINDOWS: { value: Window; label: string }[] = [
  { value: 7,  label: "Week" },
  { value: 30, label: "Month" },
  { value: 0,  label: "All-time" },
];

// ── Movement chip ─────────────────────────────────────────────────────────────
function Movement({ rank, prev, windowed }: { rank: number; prev: number | null; windowed: boolean }) {
  if (!windowed) return null;
  if (prev === null) {
    return <span className="uppercase tracking-[.06em]" style={{ fontSize: 8.5, fontWeight: 700, color: "var(--color-accent)" }}>new</span>;
  }
  const delta = prev - rank;
  if (delta > 0) return <span className="flex items-center gap-[2px]" style={{ fontSize: 10, fontWeight: 700, color: "#3fb970" }}><UpIcon />{delta}</span>;
  if (delta < 0) return <span className="flex items-center gap-[2px]" style={{ fontSize: 10, fontWeight: 700, color: "var(--color-ember)" }}><DownIcon />{-delta}</span>;
  return <span style={{ fontSize: 10, color: "var(--color-text-3)" }}>–</span>;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const [category, setCategory] = useState<Category>("clout");
  const [window_,  setWindow]   = useState<Window>(7);
  const [rows,     setRows]     = useState<BoardRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [myRank,   setMyRank]   = useState<{ rank: number; total: number } | null>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => setViewerId(user?.id ?? null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMyRank(null);
    const sb = createClient();

    async function load() {
      if (category === "streaks") {
        const { data } = await sb
          .from("profiles")
          .select("id, username, display_name, avatar_url, clout_tier, streak")
          .gt("streak", 0)
          .order("streak", { ascending: false })
          .limit(20);
        if (cancelled) return;
        setRows((data ?? []).map((p: any, i: number) => ({
          rank: i + 1, prev_rank: null,
          user_id: p.id, username: p.username, display_name: p.display_name,
          avatar_url: p.avatar_url, clout_tier: p.clout_tier,
          total: p.streak, verified_posts: 0,
        })));
        setLoading(false);
        return;
      }

      const { data } = await sb.rpc("get_leaderboard", {
        p_category: category, p_days: window_, p_room_id: null, p_limit: 25,
      });
      if (cancelled) return;
      const board = (data ?? []) as BoardRow[];
      setRows(board);
      setLoading(false);

      // Pinned "you" row when outside the visible board
      if (viewerId && !board.some(r => r.user_id === viewerId)) {
        const { data: mine } = await sb.rpc("get_my_leaderboard_rank", {
          p_category: category, p_days: window_, p_room_id: null,
        });
        if (!cancelled && mine && mine.length > 0) setMyRank(mine[0]);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [category, window_, viewerId]);

  const windowed    = category !== "streaks" && window_ > 0;
  const currentCat  = CATEGORIES.find(c => c.value === category)!;
  const isStreaks   = category === "streaks";

  return (
    <div className="h-full overflow-y-auto scroll" style={{ background: "var(--color-bg)" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "36px 24px 80px" }}>

        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <span style={{ color: "var(--color-accent)" }}><TrophyIcon /></span>
          <h1 className="font-light m-0" style={{ fontSize: 26, letterSpacing: "-.01em", color: "var(--color-text)" }}>
            Leaderboard
          </h1>
        </div>
        <p className="m-0 mb-6" style={{ fontSize: 12.5, color: "var(--color-text-3)" }}>{currentCat.hint}</p>

        {/* Category tabs */}
        <div className="flex" style={{ borderBottom: "1px solid var(--color-line)", marginBottom: 14 }}>
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className="relative py-[11px] mr-6 text-[11px] tracking-[.12em] uppercase font-semibold transition-colors"
              style={{ color: category === c.value ? "var(--color-text)" : "var(--color-text-3)" }}
              onMouseEnter={e => { if (category !== c.value) (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"; }}
              onMouseLeave={e => { if (category !== c.value) (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
            >
              {c.label}
              {category === c.value && (
                <span className="absolute left-0 right-0 bottom-0 h-[2px] rounded-full" style={{ background: "var(--color-accent)" }} />
              )}
            </button>
          ))}
        </div>

        {/* Window pills — hidden for streaks (a streak is inherently "now") */}
        {!isStreaks && (
          <div className="flex gap-[6px] mb-5">
            {WINDOWS.map(w => (
              <button
                key={w.value}
                onClick={() => setWindow(w.value)}
                className="px-3 py-[5px] rounded-full text-[11px] font-semibold tracking-[.04em] transition-all"
                style={window_ === w.value
                  ? { background: "var(--color-accent-soft)", color: "var(--color-accent)", border: "1px solid var(--color-accent)" }
                  : { background: "transparent", color: "var(--color-text-3)", border: "1px solid var(--color-line)" }}
                onMouseEnter={e => { if (window_ !== w.value) (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; }}
                onMouseLeave={e => { if (window_ !== w.value) (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
              >
                {w.label}
              </button>
            ))}
          </div>
        )}

        {/* Board */}
        {loading && (
          <div className="flex flex-col gap-[6px]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-[52px] rounded-[9px] animate-pulse" style={{ background: "var(--color-panel)" }} />
            ))}
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="flex flex-col items-center py-20 gap-3" style={{ color: "var(--color-text-3)" }}>
            <EmptyIcon />
            <p className="text-[13px] m-0">Nobody on the board yet{windowed ? " this window" : ""}.</p>
            <p className="text-[12px] m-0">Post, comment, verify — the race starts with you.</p>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="rounded-[10px] overflow-hidden" style={{ border: "1px solid var(--color-line)" }}>
            {rows.map((r, i) => (
              <Link
                key={r.user_id}
                href={`/u/${r.username}`}
                className="flex items-center gap-3 px-4 py-[11px] transition-colors"
                style={{
                  textDecoration: "none",
                  background: r.user_id === viewerId ? "var(--color-accent-soft)" : "var(--color-panel)",
                  borderTop: i > 0 ? "1px solid var(--color-line)" : "none",
                }}
                onMouseEnter={e => { if (r.user_id !== viewerId) (e.currentTarget as HTMLElement).style.background = "var(--color-panel-2)"; }}
                onMouseLeave={e => { if (r.user_id !== viewerId) (e.currentTarget as HTMLElement).style.background = "var(--color-panel)"; }}
              >
                {/* Rank */}
                <span className="tabular-nums font-bold flex-shrink-0 text-center" style={{ fontSize: r.rank <= 3 ? 15 : 13, width: 26, color: rankColor(r.rank) }}>
                  {r.rank}
                </span>

                {/* Movement */}
                <span className="flex-shrink-0 flex justify-center" style={{ width: 26 }}>
                  <Movement rank={r.rank} prev={r.prev_rank} windowed={windowed} />
                </span>

                {/* Avatar */}
                <span
                  className="grid place-items-center rounded-full text-white font-bold flex-shrink-0"
                  style={{ width: 32, height: 32, fontSize: 11, background: avatarGrad(r.clout_tier) }}
                >
                  {(r.display_name ?? r.username).slice(0, 2).toUpperCase()}
                </span>

                {/* Name */}
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-[7px]">
                    <span className="truncate font-medium" style={{ fontSize: 13.5, color: "var(--color-text)" }}>
                      {r.display_name ?? r.username}
                    </span>
                    <span
                      className="text-[9px] px-[7px] py-[1px] rounded-full font-semibold uppercase tracking-[.05em] flex-shrink-0"
                      style={tierStyle(r.clout_tier)}
                    >
                      {r.clout_tier}
                    </span>
                    {!isStreaks && r.verified_posts > 0 && (
                      <span className="flex items-center gap-[3px] flex-shrink-0" title={`${r.verified_posts} verified build${r.verified_posts === 1 ? "" : "s"}`} style={{ fontSize: 9.5, fontWeight: 700, color: "#3fb970" }}>
                        <CheckIcon />{r.verified_posts}
                      </span>
                    )}
                  </span>
                  <span className="block truncate" style={{ fontSize: 11, color: "var(--color-text-3)" }}>
                    @{r.username}
                  </span>
                </span>

                {/* Total */}
                <span className="flex items-center gap-[5px] tabular-nums font-bold flex-shrink-0" style={{ fontSize: 14.5, color: isStreaks ? "#f97316" : "var(--color-accent)" }}>
                  {isStreaks ? <><FlameIcon />{r.total}d</> : `+${r.total.toLocaleString()}`}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Pinned "you" row when outside the top */}
        {!loading && myRank && (
          <div
            className="flex items-center gap-3 px-4 py-[11px] mt-[10px] rounded-[10px]"
            style={{ background: "var(--color-accent-soft)", border: "1px solid var(--color-accent)" }}
          >
            <span className="tabular-nums font-bold text-center" style={{ fontSize: 13, width: 26, color: "var(--color-accent)" }}>
              {myRank.rank}
            </span>
            <span style={{ width: 26 }} />
            <span className="flex-1 font-medium" style={{ fontSize: 13, color: "var(--color-text)" }}>You</span>
            <span className="tabular-nums font-bold" style={{ fontSize: 14.5, color: "var(--color-accent)" }}>
              +{myRank.total.toLocaleString()}
            </span>
          </div>
        )}

      </div>
    </div>
  );
}
