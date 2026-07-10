"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { CloutTier } from "@/types";

interface Row {
  rank: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  clout_tier: CloutTier;
  total: number;
}

function avatarGrad(tier: CloutTier): string {
  switch (tier) {
    case "legend":      return "linear-gradient(150deg,var(--color-accent),#b3005c)";
    case "influencer":  return "linear-gradient(150deg,#a371f7,#6e40c9)";
    case "contributor": return "linear-gradient(150deg,#58a6ff,#1a7fd4)";
    default:            return "linear-gradient(150deg,#3a3a4a,#1e1e28)";
  }
}

function rankColor(rank: number): string {
  if (rank === 1) return "#f59e0b";
  if (rank === 2) return "#a8a9ad";
  if (rank === 3) return "#cd7f32";
  return "var(--color-text-3)";
}

interface Props {
  roomId?: string;
  title?: string;
}

// Compact top-5 "this week" board — sidebar + room page.
export default function TopContributors({ roomId, title = "Top this week" }: Props) {
  const [rows,    setRows]    = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .rpc("get_leaderboard", { p_category: "clout", p_days: 7, p_room_id: roomId ?? null, p_limit: 5 })
      .then(({ data }) => {
        if (!cancelled) { setRows((data ?? []) as Row[]); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [roomId]);

  if (!loading && rows.length === 0) return null;

  return (
    <div className="p-4" style={{ borderBottom: "1px solid var(--color-line)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="uppercase tracking-[.08em] m-0" style={{ fontSize: 10.5, color: "var(--color-text-3)" }}>
          {title}
        </p>
        <Link
          href="/leaderboard"
          className="uppercase tracking-[.06em] transition-colors"
          style={{ fontSize: 9.5, color: "var(--color-text-3)", textDecoration: "none" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"}
        >
          Full board
        </Link>
      </div>

      <div className="flex flex-col gap-[2px]">
        {loading && [0, 1, 2].map(i => (
          <div key={i} className="h-[30px] rounded-[5px] animate-pulse" style={{ background: "var(--color-panel)" }} />
        ))}
        {!loading && rows.map(r => (
          <Link
            key={r.user_id}
            href={`/u/${r.username}`}
            className="flex items-center gap-[9px] py-[5px] px-[8px] rounded-[5px] transition-colors"
            style={{ textDecoration: "none" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--color-panel)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
          >
            <span className="tabular-nums font-bold flex-shrink-0 text-center" style={{ fontSize: 11, width: 14, color: rankColor(r.rank) }}>
              {r.rank}
            </span>
            <span
              className="grid place-items-center rounded-full text-white font-bold flex-shrink-0"
              style={{ width: 22, height: 22, fontSize: 9, background: avatarGrad(r.clout_tier) }}
            >
              {(r.display_name ?? r.username).slice(0, 2).toUpperCase()}
            </span>
            <span className="flex-1 truncate" style={{ fontSize: 12.5, color: "var(--color-text-2)" }}>
              {r.display_name ?? r.username}
            </span>
            <span className="tabular-nums font-semibold flex-shrink-0" style={{ fontSize: 11.5, color: "var(--color-accent)" }}>
              +{r.total.toLocaleString()}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
