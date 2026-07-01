"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { followTag, unfollowTag } from "@/app/actions/tags";
import type { Post, Tag } from "@/types";

// ── Icons ─────────────────────────────────────────────────────────────────────
const HashIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="9"  x2="20" y2="9"  />
    <line x1="4" y1="15" x2="20" y2="15" />
    <line x1="10" y1="3" x2="8"  y2="21" />
    <line x1="16" y1="3" x2="14" y2="21" />
  </svg>
);

const UpIcon      = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 14 6-6 6 6"/></svg>;
const DownIcon    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 10 6 6 6-6"/></svg>;
const CommentIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M5 5h14v11H9l-4 3z"/></svg>;
const EmptyIcon   = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
    <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
  </svg>
);

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Follow button ─────────────────────────────────────────────────────────────
function FollowButton({ tagId, initialFollowing }: { tagId: string; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [hovered,   setHovered]   = useState(false);
  const [, startTransition]       = useTransition();

  function toggle() {
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      const res = following ? await unfollowTag(tagId) : await followTag(tagId);
      if (res.error) setFollowing(following);
    });
  }

  const isUnfollow = following && hovered;

  return (
    <button
      onClick={toggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding:       "7px 20px",
        borderRadius:  5,
        fontSize:      12,
        fontWeight:    700,
        letterSpacing: ".07em",
        transition:    "all .14s",
        border: `1px solid ${isUnfollow ? "var(--color-ember)" : following ? "var(--color-line-2)" : "var(--color-accent)"}`,
        color:         isUnfollow ? "var(--color-ember)" : following ? "var(--color-text-3)" : "#fff",
        background:    !following ? "var(--color-accent)" : "transparent",
      }}
    >
      {following ? (hovered ? "UNFOLLOW" : "FOLLOWING") : "FOLLOW"}
    </button>
  );
}

// ── Post row ──────────────────────────────────────────────────────────────────
function PostRow({ post }: { post: Post }) {
  return (
    <article
      className="px-6 py-4 transition-colors"
      style={{ borderBottom: "1px solid var(--color-line)" }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.025)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
    >
      <div className="flex items-center gap-2 mb-[6px]">
        <Link
          href={`/u/${post.author?.username ?? ""}`}
          className="uppercase tracking-[.06em] transition-colors"
          style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-2)" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"}
        >
          {post.author?.username ?? "unknown"}
        </Link>
        <span style={{ color: "var(--color-text-3)", fontSize: 10 }}>·</span>
        <span className="uppercase tracking-[.06em]" style={{ fontSize: 10, color: "var(--color-text-3)" }}>
          {timeAgo(post.created_at)}
        </span>
        {post.room && (
          <>
            <span style={{ color: "var(--color-text-3)", fontSize: 10 }}>·</span>
            <Link
              href={`/rooms/${post.room.name}`}
              className="uppercase tracking-[.06em] transition-colors"
              style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-2)" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"}
            >
              {post.room.name}
            </Link>
          </>
        )}
      </div>

      <Link
        href={`/post/${post.id}`}
        className="block mb-[8px] leading-[1.34] transition-colors"
        style={{ fontSize: 14.5, color: "var(--color-text)" }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text)"}
      >
        {post.title}
      </Link>

      <div className="flex items-center gap-[10px]" style={{ color: "var(--color-text-3)" }}>
        <div className="flex items-center gap-[4px]">
          <UpIcon />
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-accent)" }}>{fmt(post.clout)}</span>
          <DownIcon />
        </div>
        <div className="flex items-center gap-[4px]">
          <CommentIcon />
          <span style={{ fontSize: 11 }}>{post.comment_count.toLocaleString()}</span>
        </div>
        {(post.tags ?? []).filter(t => t.slug !== undefined).slice(0, 3).map(t => (
          <Link
            key={t.id}
            href={`/tags/${t.slug}`}
            className="text-[9px] tracking-[.07em] uppercase px-[6px] py-[2px] rounded-[3px] transition-colors"
            style={{ background: "rgba(255,255,255,.05)", color: "var(--color-text-3)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-accent-soft)"; (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.05)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
          >
            {t.name}
          </Link>
        ))}
      </div>
    </article>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
interface TagPageProps {
  tag: Tag;
  posts: Post[];
  isFollowing: boolean;
  currentUserId: string | null;
}

export default function TagPage({ tag, posts, isFollowing, currentUserId }: TagPageProps) {
  return (
    <div className="h-full overflow-y-auto scroll" style={{ background: "var(--color-bg)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", animation: "rise .22s ease both" }}>

        {/* ── Header ── */}
        <div className="px-8 pt-10 pb-6" style={{ borderBottom: "1px solid var(--color-line)" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Icon badge */}
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 52, height: 52,
                  borderRadius: 12,
                  background: "var(--color-accent-soft)",
                  color: "var(--color-accent)",
                }}
              >
                <HashIcon />
              </div>

              <div>
                <h1
                  className="m-0 leading-tight"
                  style={{ fontSize: 26, fontWeight: 300, letterSpacing: "-.01em", color: "var(--color-text)" }}
                >
                  {tag.name}
                </h1>
                {tag.description && (
                  <p className="mt-1 mb-0" style={{ fontSize: 13, color: "var(--color-text-3)", maxWidth: "52ch" }}>
                    {tag.description}
                  </p>
                )}
              </div>
            </div>

            {currentUserId && (
              <div className="flex-shrink-0 pt-1">
                <FollowButton tagId={tag.id} initialFollowing={isFollowing} />
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 mt-5">
            <div>
              <span className="block" style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text)" }}>
                {fmt(tag.follower_count)}
              </span>
              <span className="uppercase tracking-[.07em]" style={{ fontSize: 9.5, color: "var(--color-text-3)" }}>
                Followers
              </span>
            </div>
            <div style={{ width: 1, height: 32, background: "var(--color-line)" }} />
            <div>
              <span className="block" style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text)" }}>
                {fmt(tag.post_count)}
              </span>
              <span className="uppercase tracking-[.07em]" style={{ fontSize: 9.5, color: "var(--color-text-3)" }}>
                Posts
              </span>
            </div>
          </div>
        </div>

        {/* ── Post list ── */}
        <div>
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "var(--color-text-3)" }}>
              <EmptyIcon />
              <p className="m-0" style={{ fontSize: 13 }}>No posts with this tag yet.</p>
            </div>
          ) : (
            posts.map(post => <PostRow key={post.id} post={post} />)
          )}
        </div>

        <div className="pb-16" />
      </div>
    </div>
  );
}
