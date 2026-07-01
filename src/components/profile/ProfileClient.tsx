"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { followUser, unfollowUser } from "@/app/actions/follows";
import type { Post, Profile, CloutTier, AvailabilityStatus, UserBadge, BadgeTier, BadgeRarity } from "@/types";

// ── Icons ─────────────────────────────────────────────────────────────────────
const LocationIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>;
const GlobeIcon    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const GithubIcon   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.7.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>;
const EditIcon     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const UpIcon       = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 14 6-6 6 6"/></svg>;
const DownIcon     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 10 6 6 6-6"/></svg>;
const SaveIcon     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M6 4h12v16l-6-4-6 4z"/></svg>;
const EmptyIcon    = () => <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>;
const BadgeEmptyIcon = () => <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;

// ── Badge tier helpers ────────────────────────────────────────────────────────
function badgeTierColor(tier: BadgeTier): string {
  switch (tier) {
    case "legendary": return "#c084fc";
    case "platinum":  return "#94a3b8";
    case "gold":      return "#f59e0b";
    case "silver":    return "#a8a9ad";
    default:          return "#cd7f32";
  }
}

function badgeTierBg(tier: BadgeTier): string {
  switch (tier) {
    case "legendary": return "rgba(192,132,252,.1)";
    case "platinum":  return "rgba(148,163,184,.1)";
    case "gold":      return "rgba(245,158,11,.1)";
    case "silver":    return "rgba(168,169,173,.08)";
    default:          return "rgba(205,127,50,.08)";
  }
}

function rarityColor(rarity: BadgeRarity): string {
  switch (rarity) {
    case "secret":    return "var(--color-accent)";
    case "legendary": return "#f59e0b";
    case "epic":      return "#a371f7";
    case "rare":      return "#58a6ff";
    default:          return "var(--color-text-3)";
  }
}

function BadgeTierIcon({ tier, size = 32 }: { tier: BadgeTier; size?: number }) {
  const c = badgeTierColor(tier);
  if (tier === "legendary") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={`${c}30`}/>
    </svg>
  );
  if (tier === "platinum") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3L4 9l2 11h12l2-11z" fill={`${c}30`}/>
      <path d="M12 7v8M9 10l3-3 3 3"/>
    </svg>
  );
  if (tier === "gold") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" fill={`${c}30`}/>
      <path d="M12 7l1.5 3.5L17 11l-2.5 2.5.5 3.5L12 15.5 9 17l.5-3.5L7 11l3.5-.5z"/>
    </svg>
  );
  // silver + bronze: shield
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 3v7c0 4.5-3.5 8-8 10C7.5 20 4 16.5 4 12V5z" fill={`${c}30`}/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  );
}

function timeAgoShort(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 86400)   return "Today";
  if (s < 604800)  return `${Math.floor(s / 86400)}d ago`;
  if (s < 2592000) return `${Math.floor(s / 604800)}w ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ── Badge card ────────────────────────────────────────────────────────────────
function BadgeCard({ ub }: { ub: UserBadge }) {
  const badge = ub.badge!;
  const tier  = badge.tier as BadgeTier;
  const rarity = badge.rarity as BadgeRarity;
  const c = badgeTierColor(tier);

  return (
    <div
      className="flex flex-col items-center text-center gap-[10px] p-4 rounded-[10px] transition-all duration-150"
      style={{
        background:  badgeTierBg(tier),
        border:      `1px solid ${c}40`,
        boxShadow:   `0 0 0 0 ${c}`,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 12px ${c}30`; (e.currentTarget as HTMLElement).style.borderColor = `${c}80`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 0 ${c}`; (e.currentTarget as HTMLElement).style.borderColor = `${c}40`; }}
    >
      {/* Icon */}
      <div
        className="flex items-center justify-center rounded-full"
        style={{ width: 56, height: 56, background: `${c}18`, border: `1.5px solid ${c}50` }}
      >
        <BadgeTierIcon tier={tier} size={28} />
      </div>

      {/* Name */}
      <div>
        <p className="font-bold m-0 leading-tight" style={{ fontSize: 13.5, color: "var(--color-text)" }}>
          {badge.name}
        </p>
      </div>

      {/* Tier + rarity chips */}
      <div className="flex items-center gap-[6px] flex-wrap justify-center">
        <span
          className="uppercase tracking-[.07em] px-[7px] py-[2px] rounded-full"
          style={{ fontSize: 9.5, fontWeight: 700, background: `${c}22`, color: c }}
        >
          {tier}
        </span>
        {rarity !== "common" && (
          <span
            className="uppercase tracking-[.07em] px-[7px] py-[2px] rounded-full"
            style={{ fontSize: 9.5, fontWeight: 600, background: `${rarityColor(rarity)}18`, color: rarityColor(rarity) }}
          >
            {rarity}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="m-0 leading-snug" style={{ fontSize: 11.5, color: "var(--color-text-3)", maxWidth: "22ch" }}>
        {badge.description}
      </p>

      {/* Unlocked date */}
      <span className="uppercase tracking-[.08em]" style={{ fontSize: 9.5, color: "var(--color-text-3)", marginTop: "auto" }}>
        {timeAgoShort(ub.unlocked_at)}
      </span>
    </div>
  );
}
const PlusIcon     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>;

// Nook — 2D room placeholder
const NookRoomIcon = () => (
  <svg width="28" height="24" viewBox="0 0 28 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="24" height="16" rx="2"/>
    <path d="M2 10h24"/>
    <rect x="6" y="13" width="6" height="9"/>
    <rect x="17" y="13" width="5" height="6"/>
  </svg>
);

// ── Design helpers ────────────────────────────────────────────────────────────
function initials(p: Profile): string {
  if (p.display_name) return p.display_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return p.username.slice(0, 2).toUpperCase();
}

function bannerGrad(tier: CloutTier): string {
  switch (tier) {
    case "legend":      return "linear-gradient(150deg,#2d0a1a 0%,#0d0a14 100%)";
    case "influencer":  return "linear-gradient(150deg,#1a0d2e 0%,#0a0d14 100%)";
    case "contributor": return "linear-gradient(150deg,#0d1a2e 0%,#0a0d14 100%)";
    default:            return "linear-gradient(150deg,#14141a 0%,#0a0a0e 100%)";
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

function avatarGrad(tier: CloutTier): string {
  switch (tier) {
    case "legend":      return "linear-gradient(150deg,var(--color-accent),#b3005c)";
    case "influencer":  return "linear-gradient(150deg,#a371f7,#6e40c9)";
    case "contributor": return "linear-gradient(150deg,#58a6ff,#1a7fd4)";
    default:            return "linear-gradient(150deg,#3a3a4a,#1e1e28)";
  }
}

function availDot(status: AvailabilityStatus): string {
  switch (status) {
    case "available": return "#3fb950";
    case "busy":      return "#f0883e";
    default:          return "var(--color-text-3)";
  }
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatBadge(format: string): React.CSSProperties {
  switch (format) {
    case "showcase": return { background: "var(--color-accent-soft)", color: "var(--color-accent)" };
    case "link":     return { background: "rgba(56,139,253,.14)",     color: "#58a6ff" };
    case "media":    return { background: "rgba(255,86,48,.14)",      color: "var(--color-ember)" };
    case "poll":     return { background: "rgba(163,113,247,.14)",    color: "#a371f7" };
    default:         return { background: "rgba(255,255,255,.06)",    color: "var(--color-text-3)" };
  }
}

// ── Tier progress ─────────────────────────────────────────────────────────────
function tierProgressInfo(tier: CloutTier, score: number): { pct: number; current: number; total: number; nextTier: string; barColor: string } | null {
  switch (tier) {
    case "novice":
      return { pct: score / 500,            current: score,        total: 500,  nextTier: "Contributor", barColor: "#58a6ff" };
    case "contributor":
      return { pct: (score - 500) / 1500,   current: score - 500,  total: 1500, nextTier: "Influencer",  barColor: "#a371f7" };
    case "influencer":
      return { pct: (score - 2000) / 8000,  current: score - 2000, total: 8000, nextTier: "Legend",      barColor: "var(--color-accent)" };
    default:
      return null;
  }
}

function TierProgressBar({ profile }: { profile: Profile }) {
  const info = tierProgressInfo(profile.clout_tier, profile.clout_score);
  if (!info) return null;
  const pct = Math.min(1, Math.max(0, info.pct));
  return (
    <div className="mb-4 mt-1" style={{ padding: "10px 0 6px" }}>
      <div className="flex items-center justify-between mb-[7px]">
        <span className="text-[10.5px] uppercase tracking-[.08em]" style={{ color: "var(--color-text-3)", fontWeight: 600 }}>
          Progress to {info.nextTier}
        </span>
        <span className="text-[10.5px] tabular-nums" style={{ color: "var(--color-text-3)" }}>
          {info.current.toLocaleString()} / {info.total.toLocaleString()}
        </span>
      </div>
      <div className="w-full rounded-full overflow-hidden" style={{ height: 5, background: "var(--color-panel)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${(pct * 100).toFixed(1)}%`, background: info.barColor, boxShadow: `0 0 8px ${info.barColor}66` }}
        />
      </div>
    </div>
  );
}

// ── Stat cell ─────────────────────────────────────────────────────────────────
function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-[3px] flex-1 py-3">
      <span className="text-[17px] font-bold" style={{ color: "var(--color-text)", letterSpacing: "-.01em" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span className="text-[10px] tracking-[.1em] uppercase font-semibold" style={{ color: "var(--color-text-3)" }}>
        {label}
      </span>
    </div>
  );
}

// ── Profile post card ─────────────────────────────────────────────────────────
function ProfilePostCard({ post, authorProfile }: { post: Post; authorProfile: Profile }) {
  return (
    <article
      className="px-6 py-4 transition-colors duration-[120ms]"
      style={{ borderBottom: "1px solid var(--color-line)" }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--color-panel)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
    >
      <div className="flex gap-3 items-start">
        {/* small avatar */}
        <div
          className="flex-shrink-0 grid place-items-center rounded-full text-white font-bold"
          style={{ width: 32, height: 32, fontSize: 11, background: avatarGrad(authorProfile.clout_tier), border: "1.5px solid var(--color-line)" }}
        >
          {initials(authorProfile)}
        </div>

        <div className="flex-1 min-w-0">
          {/* meta */}
          <div className="flex flex-wrap gap-[6px] items-center mb-1">
            <span className="text-[9.5px] tracking-[.08em] uppercase px-[7px] py-[3px] rounded-[3px]" style={formatBadge(post.format)}>
              {post.format}
            </span>
            {(post.tags ?? []).map(t => (
              <span key={t.id} className="text-[9.5px] tracking-[.08em] uppercase px-[7px] py-[3px] rounded-[3px]" style={{ background: "rgba(255,255,255,.05)", color: "var(--color-text-2)" }}>
                {t.name}
              </span>
            ))}
            <span className="text-[10.5px] ml-auto" style={{ color: "var(--color-text-3)" }}>{timeAgo(post.created_at)}</span>
          </div>

          {/* title */}
          <h3 className="font-normal leading-[1.3] mb-1 mt-0" style={{ fontSize: 14.5, color: "var(--color-text)" }}>
            {post.title}
          </h3>

          {/* body preview */}
          {post.body_md && (
            <p className="text-[13px] leading-[1.55] mb-2 line-clamp-2" style={{ color: "var(--color-text-3)" }}>
              {post.body_md}
            </p>
          )}

          {/* footer */}
          <div className="flex items-center gap-3" style={{ color: "var(--color-text-3)" }}>
            <span className="text-[11px] tracking-[.05em]">{post.comment_count} comments</span>
            <div className="flex-1" />
            <button style={{ color: "var(--color-text-3)" }} title="Save"><SaveIcon /></button>
            <div className="flex items-center gap-[5px]">
              <span><UpIcon /></span>
              <span className="text-[12px] font-bold" style={{ color: "var(--color-accent)" }}>{post.clout}</span>
              <span><DownIcon /></span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Composer prompt ───────────────────────────────────────────────────────────
function ComposerPrompt({ profile }: { profile: Profile }) {
  function openCompose() {
    window.dispatchEvent(new CustomEvent("sodev:openCompose"));
  }

  return (
    <button
      onClick={openCompose}
      className="w-full flex items-center gap-3 px-6 py-3 text-left transition-colors"
      style={{ borderBottom: "1px solid var(--color-line)" }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--color-panel)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
    >
      <div
        className="flex-shrink-0 grid place-items-center rounded-full text-white font-bold"
        style={{ width: 30, height: 30, fontSize: 10, background: avatarGrad(profile.clout_tier), border: "1.5px solid var(--color-line)" }}
      >
        {initials(profile)}
      </div>
      <span className="text-[13.5px]" style={{ color: "var(--color-text-3)" }}>Share something…</span>
      <div
        className="ml-auto flex items-center gap-1 px-3 py-1 rounded-[4px] text-[12px] font-medium"
        style={{ background: "var(--color-accent)", color: "#fff" }}
      >
        <PlusIcon /> Post
      </div>
    </button>
  );
}

// ── Follow button ─────────────────────────────────────────────────────────────
function FollowButton({
  profileId,
  initFollowing,
  onToggle,
}: {
  profileId: string;
  initFollowing: boolean;
  onToggle: (nowFollowing: boolean) => void;
}) {
  const [following,   setFollowing]   = useState(initFollowing);
  const [hovered,     setHovered]     = useState(false);
  const [, startTransition]           = useTransition();

  function handleClick() {
    const next = !following;
    setFollowing(next);
    onToggle(next);

    startTransition(async () => {
      const result = next
        ? await followUser(profileId)
        : await unfollowUser(profileId);

      if (result.error) {
        // revert on failure
        setFollowing(!next);
        onToggle(!next);
      }
    });
  }

  const isUnfollow = following && hovered;

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-[7px] px-5 py-[9px] rounded-[7px] text-[12.5px] font-semibold transition-all"
      style={
        following
          ? {
              border: `1px solid ${isUnfollow ? "var(--color-ember)" : "var(--color-line)"}`,
              color: isUnfollow ? "var(--color-ember)" : "var(--color-text-2)",
              background: isUnfollow ? "rgba(255,86,48,.08)" : "var(--color-panel)",
            }
          : { background: "var(--color-accent)", color: "#fff", border: "1px solid var(--color-accent)" }
      }
    >
      {following ? (hovered ? "Unfollow" : "Following") : "Follow"}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
type Tab = "posts" | "badges" | "saved";

interface Props {
  profile: Profile;
  posts: Post[];
  postCount: number;
  badges: UserBadge[];
  savedPosts?: Post[];
  isOwn: boolean;
  isFollowing: boolean;
  currentUserId: string | null;
}

export default function ProfileClient({ profile, posts, postCount, badges, savedPosts = [], isOwn, isFollowing, currentUserId }: Props) {
  const [tab,           setTab]           = useState<Tab>("posts");
  const [followerCount, setFollowerCount] = useState(profile.follower_count);

  return (
    <div className="h-full overflow-y-auto scroll" style={{ background: "var(--color-bg)" }}>
      {/* ── Centered column ── */}
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* ── Banner ── */}
        <div
          className="relative w-full"
          style={{ height: 220, background: bannerGrad(profile.clout_tier) }}
        >
          {/* bottom scrim so avatar reads against banner */}
          <div
            className="absolute inset-x-0 bottom-0 pointer-events-none"
            style={{ height: 80, background: "linear-gradient(0deg,rgba(11,11,13,.5) 0%,transparent 100%)" }}
          />

          {/* ── Nook — 2D room placeholder ── */}
          <div
            className="absolute flex flex-col items-center justify-center gap-2 rounded-[8px] text-center"
            style={{
              top: 12, right: 12,
              width: 130, height: 100,
              border: "1px dashed var(--color-accent)",
              background: "rgba(255,46,126,.05)",
              color: "var(--color-accent)",
            }}
            title="2D Room — coming soon"
          >
            <NookRoomIcon />
            <div>
              <p className="text-[9px] font-semibold tracking-[.12em] uppercase m-0" style={{ color: "var(--color-accent)" }}>2D Room</p>
              <p className="text-[9px] tracking-[.06em] m-0" style={{ color: "var(--color-text-3)" }}>coming soon</p>
            </div>
          </div>
        </div>

        {/* ── Header row — avatar overlaps banner ── */}
        <div className="px-6" style={{ marginTop: -40 }}>
          <div className="flex items-end justify-between">
            {/* Avatar — z-index paints it above the banner */}
            <div
              className="grid place-items-center rounded-full text-white font-bold flex-shrink-0"
              style={{
                position: "relative",
                zIndex: 2,
                width: 80, height: 80,
                fontSize: 26,
                background: avatarGrad(profile.clout_tier),
                border: "3px solid var(--color-bg)",
                boxShadow: "0 4px 20px rgba(0,0,0,.5)",
              }}
            >
              {initials(profile)}
            </div>

            <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
              {/* Edit Profile — own profile only */}
              {isOwn && (
                <Link
                  href="/settings"
                  className="flex items-center gap-[7px] px-4 py-[9px] rounded-[7px] text-[12.5px] font-medium transition-all"
                  style={{ border: "1px solid var(--color-line)", color: "var(--color-text-2)", background: "var(--color-panel)" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--color-text-3)"; el.style.color = "var(--color-text)"; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--color-line)"; el.style.color = "var(--color-text-2)"; }}
                >
                  <EditIcon /> Edit Profile
                </Link>
              )}
              {/* Follow button — other users only, when logged in */}
              {!isOwn && currentUserId && (
                <FollowButton
                  profileId={profile.id}
                  initFollowing={isFollowing}
                  onToggle={nowFollowing => setFollowerCount(c => c + (nowFollowing ? 1 : -1))}
                />
              )}
            </div>
          </div>

          {/* ── Identity block ── */}
          <div className="mt-3 mb-4">
            {/* name + tier badge + availability */}
            <div className="flex items-center gap-2 flex-wrap mb-[4px]">
              <h1
                className="font-bold m-0"
                style={{ fontSize: 22, color: "var(--color-text)", letterSpacing: "-.01em" }}
              >
                {profile.display_name ?? profile.username}
              </h1>
              <span
                className="text-[11px] px-[9px] py-[2px] rounded-full font-semibold"
                style={tierStyle(profile.clout_tier)}
              >
                {profile.clout_tier}
              </span>
              <span
                className="rounded-full flex-shrink-0"
                style={{ width: 8, height: 8, background: availDot(profile.availability_status), boxShadow: `0 0 6px ${availDot(profile.availability_status)}` }}
                title={profile.availability_status}
              />
            </div>

            {/* handle + title */}
            <p className="text-[13px] m-0 mb-[6px]" style={{ color: "var(--color-text-3)" }}>
              <span style={{ color: "var(--color-accent)" }}>@{profile.username}</span>
              {profile.title && <> &nbsp;·&nbsp; <span style={{ color: "var(--color-text-2)" }}>{profile.title}</span></>}
            </p>

            {/* bio */}
            {profile.bio && (
              <p className="text-[14px] leading-[1.6] m-0" style={{ color: "var(--color-text-2)", maxWidth: "56ch" }}>
                {profile.bio}
              </p>
            )}

            {/* links */}
            {(profile.location || profile.website || profile.github_url) && (
              <div className="flex flex-wrap gap-x-4 gap-y-[5px] mt-3">
                {profile.location && (
                  <span className="flex items-center gap-[5px] text-[12px]" style={{ color: "var(--color-text-3)" }}>
                    <LocationIcon /> {profile.location}
                  </span>
                )}
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-[5px] text-[12px] transition-colors" style={{ color: "var(--color-text-3)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"}>
                    <GlobeIcon /> {profile.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
                {profile.github_url && (
                  <a href={profile.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-[5px] text-[12px] transition-colors" style={{ color: "var(--color-text-3)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"}>
                    <GithubIcon /> {profile.github_url.replace(/^https?:\/\/(www\.)?github\.com\//, "")}
                  </a>
                )}
              </div>
            )}

            {/* tech stack */}
            {profile.tech_stack.length > 0 && (
              <div className="flex flex-wrap gap-[6px] mt-3">
                {profile.tech_stack.map(t => (
                  <span
                    key={t}
                    className="text-[11px] tracking-[.04em] px-[10px] py-[3px] rounded-full"
                    style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)", color: "var(--color-text-2)" }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Tier progress bar ── */}
          <TierProgressBar profile={profile} />

          {/* ── Stats bar ── */}
          <div
            className="flex"
            style={{ borderTop: "1px solid var(--color-line)", borderBottom: "1px solid var(--color-line)", marginBottom: 16 }}
          >
            <Stat value={postCount}               label="Posts"     />
            <Stat value={profile.clout_score}     label="Clout"     />
            <Stat value={followerCount}            label="Followers" />
            <Stat value={profile.following_count} label="Following" />
            <Stat value={profile.streak > 0 ? `${profile.streak}d` : "—"} label="Streak" />
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div
          className="flex px-6 sticky top-0 z-10"
          style={{ background: "var(--color-bg)", borderBottom: "1px solid var(--color-line)" }}
        >
          {([
            "posts",
            "badges",
            ...(isOwn ? ["saved"] : []),
          ] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="relative py-[14px] mr-6 flex items-center gap-[6px] text-[11px] tracking-[.12em] uppercase font-semibold transition-colors"
              style={{ color: tab === t ? "var(--color-text)" : "var(--color-text-3)" }}
            >
              {t}
              {t === "badges" && badges.length > 0 && (
                <span
                  className="rounded-full flex items-center justify-center"
                  style={{ minWidth: 16, height: 16, background: tab === "badges" ? "var(--color-accent)" : "var(--color-panel)", color: tab === "badges" ? "#fff" : "var(--color-text-3)", fontSize: 9, fontWeight: 700, padding: "0 4px" }}
                >
                  {badges.length}
                </span>
              )}
              {t === "saved" && savedPosts.length > 0 && (
                <span
                  className="rounded-full flex items-center justify-center"
                  style={{ minWidth: 16, height: 16, background: tab === "saved" ? "var(--color-accent)" : "var(--color-panel)", color: tab === "saved" ? "#fff" : "var(--color-text-3)", fontSize: 9, fontWeight: 700, padding: "0 4px" }}
                >
                  {savedPosts.length}
                </span>
              )}
              {tab === t && (
                <span
                  className="absolute left-0 right-0 bottom-0 h-[2px] rounded-full"
                  style={{ background: "var(--color-accent)" }}
                />
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        {tab === "posts" && (
          <div>
            {isOwn && <ComposerPrompt profile={profile} />}
            {posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "var(--color-text-3)" }}>
                <EmptyIcon />
                <p className="text-[13px] tracking-wide m-0">No posts yet.</p>
              </div>
            ) : (
              posts.map(post => <ProfilePostCard key={post.id} post={post} authorProfile={profile} />)
            )}
          </div>
        )}

        {tab === "saved" && (
          <div>
            {savedPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "var(--color-text-3)" }}>
                <SaveIcon />
                <p className="text-[13px] tracking-wide m-0">No saved posts yet.</p>
                <p className="text-[12px] m-0" style={{ color: "var(--color-text-3)" }}>Hit the bookmark icon on any post to save it here.</p>
              </div>
            ) : (
              savedPosts.map(post => (
                <ProfilePostCard key={post.id} post={post} authorProfile={post.author as Profile} />
              ))
            )}
          </div>
        )}

        {tab === "badges" && (
          <div className="px-6 py-6">
            {badges.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: "var(--color-text-3)" }}>
                <BadgeEmptyIcon />
                <p className="text-[13px] tracking-wide m-0">No badges yet.</p>
                <p className="text-[12px] m-0 text-center" style={{ maxWidth: "32ch", color: "var(--color-text-3)" }}>
                  Earn badges by posting, commenting, building a streak, and gaining followers.
                </p>
              </div>
            ) : (
              <>
                <p className="text-[11px] uppercase tracking-[.1em] mb-4 m-0" style={{ color: "var(--color-text-3)", fontWeight: 600 }}>
                  {badges.length} badge{badges.length !== 1 ? "s" : ""} earned
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {badges.map(ub => <BadgeCard key={ub.id} ub={ub} />)}
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
