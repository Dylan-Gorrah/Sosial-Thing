"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { votePost, toggleBookmark } from "@/app/actions/posts";
import { getYoutubeId } from "@/components/shared/VideoEmbed";
import { VerifiedChip, SlopChip } from "@/components/post/VerifyControls";
import type { Post } from "@/types";

const UpIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 14 6-6 6 6"/></svg>;
const DownIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 10 6 6 6-6"/></svg>;
const SaveIcon       = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M6 4h12v16l-6-4-6 4z"/></svg>;
const SaveIconFilled = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" strokeLinejoin="round"><path d="M6 4h12v16l-6-4-6 4z"/></svg>;
const ShareIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>;

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

interface PostCardProps {
  post: Post;
  active: boolean;
  userVote: "up" | "down" | null;
  isBookmarked?: boolean;
  onClick: () => void;
  onVote: (postId: string, delta: number, newDirection: "up" | "down" | null) => void;
  onBookmark?: (postId: string, saved: boolean) => void;
}

export default function PostCard({ post, active, userVote, isBookmarked = false, onClick, onVote, onBookmark }: PostCardProps) {
  const [localClout,    setLocalClout]    = useState(post.clout);
  const [localVote,     setLocalVote]     = useState<"up" | "down" | null>(userVote);
  const [localSaved,    setLocalSaved]    = useState(isBookmarked);
  const [, startTransition]               = useTransition();

  // Content-first posts: showcases can carry a video, any post can carry images
  const ytId      = (post.format === "link" || post.format === "showcase") && post.link_url ? getYoutubeId(post.link_url) : null;
  const firstImg  = (post.images ?? [])[0] ?? null;
  const imgCount  = (post.images ?? []).length;

  function handleVote(e: React.MouseEvent, direction: 1 | -1) {
    e.stopPropagation();
    const dir      = direction === 1 ? "up" : "down";
    const toggling = localVote === dir;
    const delta    = toggling ? -direction : localVote !== null ? direction * 2 : direction;
    const newVote  = toggling ? null : dir;
    setLocalClout(c => c + delta);
    setLocalVote(newVote);
    onVote(post.id, delta, newVote);
    startTransition(async () => {
      const result = await votePost(post.id, direction);
      if (result.error) {
        setLocalClout(c => c - delta);
        setLocalVote(localVote);
        onVote(post.id, -delta, localVote);
      }
    });
  }

  return (
    <article
      onClick={onClick}
      className="px-[18px] py-[14px] cursor-pointer transition-colors duration-[100ms]"
      style={{
        borderBottom: "1px solid var(--color-line)",
        background: active ? "var(--color-panel)" : "transparent",
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.025)"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {/* Title row — with optional YouTube thumbnail */}
      <div className="flex items-start gap-[10px] mb-[7px]">
        <Link
          href={`/post/${post.id}`}
          onClick={e => e.stopPropagation()}
          className="flex-1 block leading-[1.34] transition-colors"
          style={{ fontSize: 14.5, color: "var(--color-text)", fontWeight: 400 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text)"}
        >
          {post.title}
        </Link>
        {ytId && (
          <div className="flex-shrink-0 overflow-hidden rounded-[4px]" style={{ width: 80, height: 45, background: "#000" }}>
            <img src={`https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`} alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        )}
        {firstImg && (
          <div className="flex-shrink-0 overflow-hidden rounded-[4px]" style={{ width: 64, height: 64, background: "var(--color-panel)", position: "relative" }}>
            <img src={firstImg.public_url} alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            {imgCount > 1 && (
              <span style={{ position: "absolute", bottom: 3, right: 3, background: "rgba(0,0,0,.7)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3, lineHeight: 1.4 }}>
                1/{imgCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Meta line */}
      <div
        className="mb-[9px] uppercase tracking-[.06em]"
        style={{ fontSize: 10, color: "var(--color-text-3)" }}
      >
        {timeAgo(post.created_at)}
        &nbsp;·&nbsp;
        <Link
          href={`/u/${post.author?.username ?? ""}`}
          onClick={e => e.stopPropagation()}
          className="font-semibold transition-colors"
          style={{ color: "var(--color-text-2)" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"}
        >
          {post.author?.username ?? "unknown"}
        </Link>
        {post.room && (
          <>
            &nbsp;·&nbsp;
            <Link
              href={`/rooms/${post.room.name}`}
              onClick={e => e.stopPropagation()}
              className="font-semibold transition-colors"
              style={{ color: "var(--color-text-2)" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"}
            >
              {post.room.name}
            </Link>
          </>
        )}
      </div>

      {/* Flair chips — youtube / tags / flags */}
      {(ytId || firstImg || (post.tags?.length ?? 0) > 0 || post.is_nsfw || post.is_oc || post.verified || post.slop_status === "flagged") && (
        <div className="flex flex-wrap gap-[5px] mb-[10px]">
          {post.verified && <VerifiedChip small />}
          {post.slop_status === "flagged" && <SlopChip small />}
          {ytId && (
            <span className="text-[9px] tracking-[.07em] uppercase px-[6px] py-[2px] rounded-[3px]" style={{ background: "rgba(255,0,0,.15)", color: "#ff4444" }}>
              YouTube
            </span>
          )}
          {firstImg && (
            <span className="text-[9px] tracking-[.07em] uppercase px-[6px] py-[2px] rounded-[3px]" style={{ background: "rgba(255,86,48,.14)", color: "var(--color-ember)" }}>
              {imgCount === 1 ? "Photo" : `Gallery · ${imgCount}`}
            </span>
          )}
          {(post.tags ?? []).map(t => (
            <Link
              key={t.id}
              href={`/tags/${t.slug}`}
              onClick={e => e.stopPropagation()}
              className="text-[9px] tracking-[.07em] uppercase px-[6px] py-[2px] rounded-[3px] transition-colors"
              style={{ background: "rgba(255,255,255,.05)", color: "var(--color-text-3)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-accent-soft)"; (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.05)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
            >
              {t.name}
            </Link>
          ))}
          {post.is_nsfw && (
            <span className="text-[9px] tracking-[.07em] uppercase px-[6px] py-[2px] rounded-[3px]" style={{ background: "rgba(255,86,48,.14)", color: "var(--color-ember)" }}>
              NSFW
            </span>
          )}
          {post.is_oc && (
            <span className="text-[9px] tracking-[.07em] uppercase px-[6px] py-[2px] rounded-[3px]" style={{ background: "rgba(56,139,253,.14)", color: "#58a6ff" }}>
              OC
            </span>
          )}
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-[10px]" style={{ color: "var(--color-text-3)" }}>
        {/* Comment count */}
        <span className="text-[10px] tracking-[.06em] uppercase">
          {post.comment_count.toLocaleString()} comments
        </span>

        <div className="flex-1" />

        {/* Ghost actions */}
        <button
          onClick={e => {
            e.stopPropagation();
            const next = !localSaved;
            setLocalSaved(next);
            onBookmark?.(post.id, next);
            startTransition(async () => {
              const res = await toggleBookmark(post.id);
              if (res.error) setLocalSaved(!next);
            });
          }}
          title={localSaved ? "Unsave" : "Save"}
          className="transition-colors"
          style={{ color: localSaved ? "var(--color-accent)" : "var(--color-text-3)" }}
          onMouseEnter={e => { if (!localSaved) (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"; }}
          onMouseLeave={e => { if (!localSaved) (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
        >
          {localSaved ? <SaveIconFilled /> : <SaveIcon />}
        </button>
        <button
          onClick={e => e.stopPropagation()}
          title="Share"
          className="transition-colors"
          style={{ color: "var(--color-text-3)" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"}
        >
          <ShareIcon />
        </button>

        {/* Vote cluster: ↓ SCORE ↑ */}
        <div className="flex items-center gap-[4px]">
          <button
            onClick={e => handleVote(e, -1)}
            title="Lower"
            className="transition-colors"
            style={{ color: localVote === "down" ? "var(--color-ember)" : "var(--color-text-3)" }}
            onMouseEnter={e => { if (localVote !== "down") (e.currentTarget as HTMLElement).style.color = "var(--color-ember)"; }}
            onMouseLeave={e => { if (localVote !== "down") (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
          >
            <DownIcon />
          </button>
          <span
            className="text-[12px] font-bold min-w-[18px] text-center tabular-nums"
            style={{ color: localVote === "up" ? "var(--color-accent)" : localVote === "down" ? "var(--color-ember)" : "var(--color-accent)" }}
          >
            {localClout.toLocaleString()}
          </span>
          <button
            onClick={e => handleVote(e, 1)}
            title="Boost"
            className="transition-colors"
            style={{ color: localVote === "up" ? "var(--color-accent)" : "var(--color-text-3)" }}
            onMouseEnter={e => { if (localVote !== "up") (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"; }}
            onMouseLeave={e => { if (localVote !== "up") (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
          >
            <UpIcon />
          </button>
        </div>
      </div>
    </article>
  );
}
