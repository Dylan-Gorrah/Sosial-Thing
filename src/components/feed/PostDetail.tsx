"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { votePost, deletePost } from "@/app/actions/posts";
import { followUser, unfollowUser } from "@/app/actions/follows";
import { followTag, unfollowTag } from "@/app/actions/tags";
import Markdown from "@/components/shared/Markdown";
import CommentSection from "@/components/feed/CommentSection";
import { detectEmbed, VideoPlayer } from "@/components/shared/VideoEmbed";
import { LinkEmbed } from "@/components/shared/LinkEmbed";
import VerifyControls, { VerifiedChip, SlopChip } from "@/components/post/VerifyControls";
import SaveButton from "@/components/shared/SaveButton";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import ReportModal from "@/components/shared/ReportModal";
import type { Post, PostFormat, Tag, PostImage } from "@/types";

// ── Image carousel ────────────────────────────────────────────────────────────
function ImageCarousel({ images }: { images: PostImage[] }) {
  const [idx, setIdx] = useState(0);
  const sorted = [...images].sort((a, b) => a.display_order - b.display_order);

  useEffect(() => {
    if (sorted.length <= 1) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft")  setIdx(i => (i - 1 + sorted.length) % sorted.length);
      if (e.key === "ArrowRight") setIdx(i => (i + 1) % sorted.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sorted.length]);

  if (sorted.length === 0) return null;
  const cur = sorted[idx];

  return (
    <div style={{ background: "#0a0a0e", position: "relative", width: "100%" }}>
      {/* Image */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200, maxHeight: 640 }}>
        <img
          key={cur.id}
          src={cur.public_url}
          alt={cur.caption ?? ""}
          style={{ maxWidth: "100%", maxHeight: 640, objectFit: "contain", display: "block" }}
        />
      </div>

      {/* Prev/Next arrows */}
      {sorted.length > 1 && (
        <>
          <button
            onClick={() => setIdx(i => (i - 1 + sorted.length) % sorted.length)}
            aria-label="Previous image"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.15)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 6l-6 6 6 6"/></svg>
          </button>
          <button
            onClick={() => setIdx(i => (i + 1) % sorted.length)}
            aria-label="Next image"
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.15)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>
          </button>
        </>
      )}

      {/* Counter top-right */}
      {sorted.length > 1 && (
        <div style={{ position: "absolute", top: 10, right: 12, background: "rgba(0,0,0,.6)", borderRadius: 5, padding: "3px 9px", color: "#fff", fontSize: 11, fontWeight: 600, letterSpacing: ".04em" }}>
          {idx + 1} / {sorted.length}
        </div>
      )}

      {/* Dot indicators (up to 10) */}
      {sorted.length > 1 && sorted.length <= 10 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 5, padding: "8px 0 6px" }}>
          {sorted.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Image ${i + 1}`}
              style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 3, background: i === idx ? "#fff" : "rgba(255,255,255,.35)", border: "none", cursor: "pointer", padding: 0, transition: "width 180ms, background 180ms" }}
            />
          ))}
        </div>
      )}

      {/* Caption */}
      {cur.caption && (
        <p style={{ margin: 0, padding: "6px 16px 10px", color: "var(--color-text-3)", fontSize: 12.5, textAlign: "center" }}>
          {cur.caption}
        </p>
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const SaveIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M6 4h12v16l-6-4-6 4z" /></svg>;
const CommentIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M5 5h14v11H9l-4 3z" /></svg>;
const MoreIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>;
const UpIcon      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 14 6-6 6 6" /></svg>;
const DownIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 10 6 6 6-6" /></svg>;
const LinkIcon    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;
const EditIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>;
const TrashIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>;
const FlagIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>;
const SelectIcon  = () => <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 12h6M12 9v6" /></svg>;

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function chipStyle(format: PostFormat): React.CSSProperties {
  switch (format) {
    case "showcase": return { background: "var(--color-accent-soft)", color: "var(--color-accent)" };
    case "link":     return { background: "rgba(56,139,253,.14)",     color: "#58a6ff" };
    case "media":    return { background: "rgba(255,86,48,.14)",      color: "var(--color-ember)" };
    case "poll":     return { background: "rgba(163,113,247,.14)",    color: "#a371f7" };
    default:         return { background: "rgba(255,255,255,.06)",    color: "var(--color-text-3)" };
  }
}

function GhostBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick?: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex items-center gap-[5px] transition-colors"
      style={{ color: "var(--color-text-3)", fontSize: 11, letterSpacing: ".05em", cursor: "pointer" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
    >
      {children}
    </button>
  );
}

// ── Tag chip with inline follow ───────────────────────────────────────────────
function TagChip({ tag }: { tag: Tag }) {
  const [followState, setFollowState]   = useState<"loading" | "following" | "not-following">("loading");
  const [hovered,     setHovered]       = useState(false);
  const [, startTransition]             = useTransition();

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setFollowState("not-following"); return; }
      const { data } = await sb
        .from("tag_follows")
        .select("tag_id")
        .eq("user_id", user.id)
        .eq("tag_id", tag.id)
        .maybeSingle();
      setFollowState(data ? "following" : "not-following");
    });
  }, [tag.id]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = followState === "following" ? "not-following" : "following";
    setFollowState(next);
    startTransition(async () => {
      const res = followState === "following"
        ? await unfollowTag(tag.id)
        : await followTag(tag.id);
      if (res.error) setFollowState(followState);
    });
  }

  return (
    <span
      className="inline-flex items-center rounded-[3px] transition-all"
      style={{
        background: hovered ? "var(--color-accent-soft)" : "rgba(255,255,255,.05)",
        color:      hovered ? "var(--color-accent)"      : "var(--color-text-3)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={`/tags/${tag.slug}`}
        className="text-[9.5px] tracking-[.08em] uppercase px-[7px] py-[3px]"
        style={{ color: "inherit" }}
      >
        {tag.name}
      </Link>
      {hovered && followState !== "loading" && (
        <button
          onClick={toggle}
          title={followState === "following" ? "Unfollow tag" : "Follow tag"}
          className="pr-[6px] transition-colors"
          style={{
            fontSize:      10,
            fontWeight:    700,
            lineHeight:    1,
            color:         followState === "following" ? "var(--color-ember)" : "var(--color-accent)",
          }}
        >
          {followState === "following" ? "✓" : "+"}
        </button>
      )}
    </span>
  );
}

// ── Inline follow button ──────────────────────────────────────────────────────
function InlineFollowButton({ authorId }: { authorId: string }) {
  const [state,   setState]   = useState<"loading" | "own" | "following" | "not-following">("loading");
  const [hovered, setHovered] = useState(false);
  const [, startTransition]   = useTransition();

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user)                { setState("not-following"); return; }
      if (user.id === authorId) { setState("own");           return; }
      const { data } = await sb
        .from("follows").select("id")
        .eq("follower_id", user.id).eq("following_id", authorId)
        .maybeSingle();
      setState(data ? "following" : "not-following");
    });
  }, [authorId]);

  if (state === "loading" || state === "own") return null;

  const isUnfollow = state === "following" && hovered;

  function toggle() {
    const next = state === "following" ? "not-following" : "following";
    setState(next);
    startTransition(async () => {
      const res = state === "following"
        ? await unfollowUser(authorId)
        : await followUser(authorId);
      if (res.error) setState(state);
    });
  }

  return (
    <button
      onClick={toggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="transition-all"
      style={{
        fontSize:     10,
        letterSpacing: ".06em",
        fontWeight:   600,
        padding:      "2px 8px",
        borderRadius: 4,
        border:       `1px solid ${isUnfollow ? "var(--color-ember)" : state === "following" ? "var(--color-line)" : "var(--color-accent)"}`,
        color:        isUnfollow ? "var(--color-ember)" : state === "following" ? "var(--color-text-3)" : "var(--color-accent)",
        background:   "transparent",
      }}
    >
      {state === "following" ? (hovered ? "UNFOLLOW" : "FOLLOWING") : "FOLLOW"}
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
interface PostDetailProps {
  post: Post | null;
  onBack?: () => void;
  currentUserId?: string | null;
  userVote?: "up" | "down" | null;
  onVote?: (postId: string, delta: number, newDirection: "up" | "down" | null) => void;
  onDeleted?: (postId: string) => void;
}

export default function PostDetail({ post, onBack, currentUserId = null, userVote = null, onVote, onDeleted }: PostDetailProps) {
  const router = useRouter();
  const [localClout, setLocalClout] = useState(post?.clout ?? 0);
  const [localVote,  setLocalVote]  = useState<"up" | "down" | null>(userVote);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reportOpen,  setReportOpen]  = useState(false);
  const [deleteErr,   setDeleteErr]   = useState<string | null>(null);
  const [deleting,   startDelete]   = useTransition();
  const [, startVote]               = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  // Reset local vote/score when a different post loads into the pane
  useEffect(() => {
    setLocalClout(post?.clout ?? 0);
    setLocalVote(userVote);
    setMenuOpen(false);
  }, [post?.id, post?.clout, userVote]);

  // Close the ⋯ menu on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: "var(--color-text-3)" }}>
        <SelectIcon />
        <p style={{ fontSize: 12.5, letterSpacing: ".04em" }}>Select a post to read it</p>
      </div>
    );
  }

  const isOwner         = !!currentUserId && currentUserId === post.user_id;
  const withinEditWindow = Date.now() - new Date(post.created_at).getTime() < 24 * 60 * 60 * 1000;

  // TS can't carry the null-guard above into closures — capture the id once.
  const postId = post.id;

  // Optimistic voting — mirrors PostCard: update UI instantly, reconcile on error
  function handleVote(direction: 1 | -1) {
    if (!currentUserId) return;
    const dir      = direction === 1 ? "up" : "down";
    const toggling = localVote === dir;
    const delta    = toggling ? -direction : localVote !== null ? direction * 2 : direction;
    const newVote  = toggling ? null : dir;
    setLocalClout(c => c + delta);
    setLocalVote(newVote);
    onVote?.(postId, delta, newVote);
    startVote(async () => {
      const res = await votePost(postId, direction);
      if (res.error) {
        setLocalClout(c => c - delta);
        setLocalVote(localVote);
        onVote?.(postId, -delta, localVote);
      }
    });
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/post/${postId}`);
    setCopied(true);
    setTimeout(() => { setCopied(false); setMenuOpen(false); }, 1500);
  }

  function handleDelete() {
    setMenuOpen(false);
    setDeleteErr(null);
    setConfirmOpen(true);
  }

  function confirmDelete() {
    setDeleteErr(null);
    startDelete(async () => {
      const res = await deletePost(postId);
      if (res.error) { setDeleteErr(res.error); return; }
      setConfirmOpen(false);
      onDeleted?.(postId);
      onBack?.();
      if (!onDeleted && !onBack) { router.push("/feed"); router.refresh(); }
    });
  }

  function scrollToComments() {
    document.getElementById("detail-comments")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const sm        = post.showcase_meta;
  // Content-first posts: showcases can carry a video link, any post can carry images
  const embed     = ((post.format === "link" || post.format === "showcase") && post.link_url) ? detectEmbed(post.link_url) : null;
  const images    = post.images ?? [];
  const plainLink = post.format === "link" && !!post.link_url && !embed;
  const hasMedia  = embed !== null || images.length > 0 || plainLink;

  return (
    <>
    <div className="h-full overflow-y-auto scroll" style={{ background: "var(--color-bg)", paddingTop: hasMedia ? 10 : 0 }}>
      {/* Video / external link gets a wider stage than the text column — ~30% bigger */}
      {(embed || plainLink) && (
        <div style={{ animation: "rise .22s ease both", maxWidth: 988, margin: "0 auto" }}>
          {embed ? <VideoPlayer embed={embed} /> : <LinkEmbed url={post.link_url!} />}
        </div>
      )}
      <div style={{ animation: (embed || plainLink) ? undefined : "rise .22s ease both", maxWidth: 760, margin: "0 auto" }}>

        {/* ── Media at top — image carousel (video renders wider, above) ── */}
        {images.length > 0 && <ImageCarousel images={images} />}

        {/* ── Header ── */}
        <div className={`px-8 ${hasMedia ? "pt-5" : "pt-8"} pb-0`}>

          {/* Format + tags + flags */}
          <div className="flex flex-wrap gap-[6px] mb-4">
            <span
              className="text-[9.5px] tracking-[.08em] uppercase px-[7px] py-[3px] rounded-[3px]"
              style={chipStyle(post.format)}
            >
              {post.format}
            </span>
            {(post.tags ?? []).map(t => (
              <TagChip key={t.id} tag={t} />
            ))}
            {post.is_nsfw && <span className="text-[9.5px] tracking-[.08em] uppercase px-[7px] py-[3px] rounded-[3px]" style={{ background: "rgba(255,86,48,.14)", color: "var(--color-ember)" }}>NSFW</span>}
            {post.is_oc   && <span className="text-[9.5px] tracking-[.08em] uppercase px-[7px] py-[3px] rounded-[3px]" style={{ background: "rgba(56,139,253,.14)", color: "#58a6ff" }}>OC</span>}
            {post.verified && <VerifiedChip />}
            {post.slop_status === "flagged" && <SlopChip />}
          </div>

          {/* Title */}
          <h2
            className="mt-0 mb-3 leading-[1.22]"
            style={{ fontSize: 24, fontWeight: 300, letterSpacing: "-.01em", color: "var(--color-text)" }}
          >
            {post.title}
          </h2>

          {/* Meta */}
          <div className="mb-6 flex items-center flex-wrap gap-x-[8px] gap-y-[4px]">
            <span className="uppercase tracking-[.07em]" style={{ fontSize: 10.5, color: "var(--color-text-3)" }}>
              {timeAgo(post.created_at)}
            </span>
            {post.edited_at && (
              <>
                <span style={{ color: "var(--color-text-3)", fontSize: 10 }}>·</span>
                <span className="uppercase tracking-[.07em]" style={{ fontSize: 10.5, color: "var(--color-text-3)" }}>edited</span>
              </>
            )}
            <span style={{ color: "var(--color-text-3)", fontSize: 10 }}>·</span>
            <Link
              href={`/u/${post.author?.username ?? ""}`}
              className="font-semibold uppercase tracking-[.07em] transition-colors"
              style={{ fontSize: 10.5, color: "var(--color-text-2)" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"}
            >
              {post.author?.username ?? "unknown"}
            </Link>
            {post.author?.id && (
              <InlineFollowButton authorId={post.author.id} />
            )}
            {post.room && (
              <>
                <span style={{ color: "var(--color-text-3)", fontSize: 10 }}>·</span>
                <Link
                  href={`/rooms/${post.room.name}`}
                  className="font-semibold uppercase tracking-[.07em] transition-colors"
                  style={{ fontSize: 10.5, color: "var(--color-text-2)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"}
                >
                  {post.room.name}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* ── Media / link / showcase meta ── */}
        <div className="px-8">
          {post.format === "link" && post.link_url && !embed && (
            <a
              href={post.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mb-5 px-4 py-[9px] rounded-[6px] text-[12.5px] transition-all"
              style={{ background: "var(--color-panel)", color: "var(--color-text-2)", border: "1px solid var(--color-line)" }}
              onMouseEnter={e => { (e.currentTarget).style.borderColor = "var(--color-text-3)"; (e.currentTarget).style.color = "var(--color-text)"; }}
              onMouseLeave={e => { (e.currentTarget).style.borderColor = "var(--color-line)"; (e.currentTarget).style.color = "var(--color-text-2)"; }}
            >
              <LinkIcon />
              {post.link_url.replace(/^https?:\/\//, "").split("/")[0]}
            </a>
          )}

          {post.format === "showcase" && sm && (
            <div className="flex flex-wrap gap-4 mb-5">
              {sm.repo_url && (
                <a href={sm.repo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[12.5px] tracking-[.04em] transition-colors" style={{ color: "var(--color-accent)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = ".75"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "1"}>
                  <LinkIcon /> View Repo
                </a>
              )}
              {sm.demo_url && (
                <a href={sm.demo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[12.5px] tracking-[.04em] transition-colors" style={{ color: "#58a6ff" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = ".75"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "1"}>
                  <LinkIcon /> Live Demo
                </a>
              )}
            </div>
          )}

          {/* Body */}
          {post.body_md && (
            <div className="mb-6" style={{ maxWidth: "68ch" }}>
              <Markdown prose>{post.body_md}</Markdown>
            </div>
          )}

          {/* ── Actions bar ── */}
          <div
            className="flex items-center gap-[14px] py-4"
            style={{ borderTop: "1px solid var(--color-line)", borderBottom: "1px solid var(--color-line)" }}
          >
            <SaveButton postId={post.id} />
            <GhostBtn title="Jump to comments" onClick={scrollToComments}>
              <CommentIcon />
              <span className="uppercase tracking-[.05em]">{post.comment_count.toLocaleString()} Comments</span>
            </GhostBtn>
            <VerifyControls post={post} />

            {/* More (⋯) menu */}
            <div className="relative" ref={menuRef}>
              <button
                title="More"
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center gap-[5px] transition-colors"
                style={{ color: menuOpen ? "var(--color-text)" : "var(--color-text-3)", fontSize: 11, letterSpacing: ".05em", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"}
                onMouseLeave={e => { if (!menuOpen) (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
              >
                <MoreIcon />
              </button>

              {menuOpen && (
                <div
                  className="absolute left-0 top-[calc(100%+8px)] rounded-[8px] overflow-hidden z-50"
                  style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)", minWidth: 178, boxShadow: "0 8px 24px rgba(0,0,0,.3)" }}
                >
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-[9px] w-full px-[13px] py-[9px] text-left transition-colors"
                    style={{ fontSize: 12.5, fontWeight: 500, color: copied ? "var(--color-accent)" : "var(--color-text-2)" }}
                    onMouseEnter={e => { if (!copied) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.05)"; }}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  >
                    <LinkIcon /> {copied ? "Link copied!" : "Copy link"}
                  </button>

                  {isOwner && withinEditWindow && (
                    <Link
                      href={`/post/${post.id}`}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-[9px] w-full px-[13px] py-[9px] text-left transition-colors"
                      style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-text-2)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.05)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                    >
                      <EditIcon /> Edit post
                    </Link>
                  )}

                  {isOwner && (
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex items-center gap-[9px] w-full px-[13px] py-[9px] text-left transition-colors"
                      style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-ember)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,86,48,.1)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                    >
                      <TrashIcon /> {deleting ? "Deleting…" : "Delete post"}
                    </button>
                  )}

                  {currentUserId && !isOwner && (
                    <button
                      onClick={() => { setMenuOpen(false); setReportOpen(true); }}
                      className="flex items-center gap-[9px] w-full px-[13px] py-[9px] text-left transition-colors"
                      style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-ember)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,86,48,.1)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                    >
                      <FlagIcon /> Report post
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1" />

            {/* Vote cluster */}
            <div className="flex items-center gap-[7px]">
              <button
                title={currentUserId ? "Lower" : "Sign in to vote"}
                onClick={() => handleVote(-1)}
                className="transition-colors"
                style={{ color: localVote === "down" ? "var(--color-ember)" : "var(--color-text-3)", cursor: currentUserId ? "pointer" : "default" }}
                onMouseEnter={e => { if (localVote !== "down") (e.currentTarget as HTMLElement).style.color = "var(--color-ember)"; }}
                onMouseLeave={e => { if (localVote !== "down") (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
              >
                <DownIcon />
              </button>
              <span className="font-bold tabular-nums" style={{ fontSize: 16, color: localVote === "down" ? "var(--color-ember)" : "var(--color-accent)", minWidth: 40, textAlign: "center" }}>
                {localClout.toLocaleString()}
              </span>
              <button
                title={currentUserId ? "Boost" : "Sign in to vote"}
                onClick={() => handleVote(1)}
                className="transition-colors"
                style={{ color: localVote === "up" ? "var(--color-accent)" : "var(--color-text-3)", cursor: currentUserId ? "pointer" : "default" }}
                onMouseEnter={e => { if (localVote !== "up") (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"; }}
                onMouseLeave={e => { if (localVote !== "up") (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
              >
                <UpIcon />
              </button>
            </div>
          </div>

          {/* ── Comments ── */}
          <div id="detail-comments" className="pt-5 pb-2 flex items-center justify-between mb-4">
            <span className="uppercase tracking-[.06em]" style={{ fontSize: 10.5, color: "var(--color-text-2)", fontWeight: 600 }}>
              {post.comment_count.toLocaleString()} Comments
            </span>
            <span style={{ fontSize: 10.5, color: "var(--color-text-3)" }}>
              Sort: <span style={{ color: "var(--color-accent)" }}>new</span>
            </span>
          </div>

          <CommentSection postId={post.id} commentCount={post.comment_count} />

          <div className="pb-12" />
        </div>
      </div>
    </div>

    <ConfirmDialog
      open={confirmOpen}
      tone="danger"
      title="Delete this post?"
      message="This permanently removes your post and its comments. This can't be undone."
      confirmLabel="Delete post"
      busyLabel="Deleting…"
      busy={deleting}
      error={deleteErr}
      onConfirm={confirmDelete}
      onCancel={() => { if (!deleting) setConfirmOpen(false); }}
    />

    <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} postId={postId} />
    </>
  );
}
