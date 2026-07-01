"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { addComment } from "@/app/actions/comments";
import { votePost   } from "@/app/actions/posts";
import Markdown from "@/components/shared/Markdown";
import { detectEmbed, VideoPlayer } from "@/components/shared/VideoEmbed";
import type { Post, Comment, PostFormat } from "@/types";

// ── Avatar helpers ─────────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#ff2e7e","#ff5630","#2ea44f","#388bfd","#8b5cf6","#f59e0b"];
function avatarColor(username: string) {
  return AVATAR_COLORS[username.charCodeAt(0) % AVATAR_COLORS.length];
}
function avatarInitial(c: Comment) {
  return (c.author?.display_name ?? c.author?.username ?? "?")[0].toUpperCase();
}

// ── Time helper ───────────────────────────────────────────────────────────────
function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Format badge ──────────────────────────────────────────────────────────────
function formatStyle(format: PostFormat): React.CSSProperties {
  switch (format) {
    case "showcase": return { background: "var(--color-accent-soft)", color: "var(--color-accent)" };
    case "link":     return { background: "rgba(56,139,253,.14)",     color: "#58a6ff" };
    case "media":    return { background: "rgba(255,86,48,.14)",      color: "var(--color-ember)" };
    case "poll":     return { background: "rgba(163,113,247,.14)",    color: "#a371f7" };
    default:         return { background: "rgba(255,255,255,.06)",    color: "var(--color-text-3)" };
  }
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const UpIcon      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 14 6-6 6 6"/></svg>;
const DownIcon    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 10 6 6 6-6"/></svg>;
const SaveIcon    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M6 4h12v16l-6-4-6 4z"/></svg>;
const ShareIcon   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/></svg>;
const CommentIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M5 5h14v11H9l-4 3z"/></svg>;
const LinkIcon    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
const HeartIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const ReplyIcon   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>;

// ── Comment form ──────────────────────────────────────────────────────────────
function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="px-4 py-[7px] rounded-[6px] text-[12.5px] font-semibold text-white transition-all" style={{ background: "var(--color-accent)", opacity: pending ? 0.7 : 1 }}>
      {pending ? "Posting…" : label}
    </button>
  );
}

function CommentForm({ postId, parentId, onSuccess, placeholder = "Write a comment…", autoFocus = false }: {
  postId: string; parentId?: string; onSuccess?: () => void; placeholder?: string; autoFocus?: boolean;
}) {
  const [state, action] = useActionState(addComment, null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state?.success) {
      if (ref.current) ref.current.value = "";
      onSuccess?.();
    }
  }, [state?.success]);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="post_id"   value={postId} />
      <input type="hidden" name="parent_id" value={parentId ?? ""} />
      <textarea
        ref={ref}
        name="content"
        placeholder={placeholder}
        required
        autoFocus={autoFocus}
        rows={3}
        maxLength={2000}
        className="w-full rounded-[8px] px-3 py-[10px] text-[13.5px] leading-[1.55] resize-none outline-none transition-all"
        style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)", color: "var(--color-text)" }}
        onFocus={e => (e.currentTarget.style.borderColor = "var(--color-accent)")}
        onBlur={e  => (e.currentTarget.style.borderColor = "var(--color-line)")}
      />
      {state?.error && <p className="text-[12px]" style={{ color: "var(--color-ember)" }}>{state.error}</p>}
      <div className="flex justify-end"><SubmitBtn label="Post Comment" /></div>
    </form>
  );
}

// ── Comment row ───────────────────────────────────────────────────────────────
function CommentRow({ comment, replies, postId, onRefresh }: {
  comment: Comment; replies: Comment[]; postId: string; onRefresh: () => void;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const username = comment.author?.username ?? "unknown";

  return (
    <div className="flex gap-3">
      <Link href={`/u/${username}`} className="flex-shrink-0">
        <div className="grid place-items-center rounded-full text-white font-bold" style={{ width: 30, height: 30, background: avatarColor(username), fontSize: 12 }}>
          {avatarInitial(comment)}
        </div>
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-[8px] mb-[5px]">
          <Link href={`/u/${username}`} className="text-[13px] font-semibold transition-colors" style={{ color: "var(--color-text)" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text)"}
          >
            {comment.author?.display_name ?? username}
          </Link>
          <span className="text-[11px]" style={{ color: "var(--color-text-3)" }}>{timeAgo(comment.created_at)}</span>
        </div>

        {/* Markdown rendering: developers write code blocks in comments — it has to work */}
        <div className="mb-2">
          <Markdown>{comment.content}</Markdown>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <button className="flex items-center gap-[5px] text-[11px] tracking-[.04em] transition-colors" style={{ color: "var(--color-text-3)" }} title="Like (Phase 2)">
            <HeartIcon />
            {comment.like_count > 0 && comment.like_count}
          </button>
          <button
            onClick={() => setReplyOpen(v => !v)}
            className="flex items-center gap-[5px] text-[11px] tracking-[.04em] font-medium transition-colors"
            style={{ color: replyOpen ? "var(--color-accent)" : "var(--color-text-3)" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = replyOpen ? "var(--color-accent)" : "var(--color-text-3)"}
          >
            <ReplyIcon /> Reply
          </button>
        </div>

        {replyOpen && (
          <div className="mb-4">
            <CommentForm postId={postId} parentId={comment.id} placeholder={`Reply to ${username}…`} autoFocus
              onSuccess={() => { setReplyOpen(false); onRefresh(); }}
            />
          </div>
        )}

        {/* Replies — indented with a left bar. One level deep is intentional. */}
        {replies.length > 0 && (
          <div className="flex flex-col gap-4 pl-3" style={{ borderLeft: "2px solid var(--color-line)" }}>
            {replies.map(reply => (
              <div key={reply.id} className="flex gap-3">
                <Link href={`/u/${reply.author?.username ?? ""}`} className="flex-shrink-0">
                  <div className="grid place-items-center rounded-full text-white font-bold" style={{ width: 24, height: 24, background: avatarColor(reply.author?.username ?? "?"), fontSize: 10 }}>
                    {avatarInitial(reply)}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-[8px] mb-[4px]">
                    <Link href={`/u/${reply.author?.username ?? ""}`} className="text-[12.5px] font-semibold transition-colors" style={{ color: "var(--color-text)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text)"}
                    >
                      {reply.author?.display_name ?? reply.author?.username ?? "unknown"}
                    </Link>
                    <span className="text-[11px]" style={{ color: "var(--color-text-3)" }}>{timeAgo(reply.created_at)}</span>
                  </div>
                  <Markdown>{reply.content}</Markdown>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
interface Props {
  post: Post;
  comments: Comment[];
  currentUserId: string | null;
  initialVote: "up" | "down" | null;
}

export default function PostPage({ post, comments, currentUserId, initialVote }: Props) {
  const router = useRouter();

  // Local vote state so the buttons feel instant — no round trip before UI updates
  const [localClout, setLocalClout] = useState(post.clout);
  const [localVote,  setLocalVote]  = useState<"up" | "down" | null>(initialVote);
  const [, startVoteTransition]     = useTransition();
  const [copied, setCopied]         = useState(false);

  function handleVote(direction: 1 | -1) {
    if (!currentUserId) return;
    const dir      = direction === 1 ? "up" : "down";
    const toggling = localVote === dir;
    const delta    = toggling ? -direction : localVote !== null ? direction * 2 : direction;
    const newVote  = toggling ? null : dir;

    setLocalClout(c => c + delta);
    setLocalVote(newVote);

    startVoteTransition(async () => {
      const result = await votePost(post.id, direction);
      if (result.error) {
        setLocalClout(c => c - delta);
        setLocalVote(localVote);
      }
    });
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Build comment tree from flat list
  const topLevel = comments.filter(c => !c.parent_id);
  const repliesByParent = comments
    .filter(c => c.parent_id)
    .reduce<Record<string, Comment[]>>((acc, c) => {
      acc[c.parent_id!] = [...(acc[c.parent_id!] ?? []), c];
      return acc;
    }, {});

  const sm    = post.showcase_meta;
  const embed = (post.format === "link" && post.link_url) ? detectEmbed(post.link_url) : null;

  return (
    <div className="h-full overflow-y-auto scroll" style={{ background: "var(--color-bg)", paddingTop: embed ? 10 : 0 }}>
      {/* Video gets a wider stage than the text column — ~30% bigger, testing how it reads */}
      {embed && (
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <VideoPlayer embed={embed} />
        </div>
      )}
      <div style={{ maxWidth: 800, margin: "0 auto" }}>

      <div style={{ padding: embed ? "24px 24px 80px" : "40px 24px 80px" }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-[6px] mb-3">
            <span className="text-[9.5px] tracking-[.1em] uppercase px-[7px] py-[3px] rounded-[3px] font-semibold" style={formatStyle(post.format)}>
              {post.format}
            </span>
            {(post.tags ?? []).map(t => (
              <span key={t.id} className="text-[9.5px] tracking-[.09em] uppercase px-[7px] py-[3px] rounded-[3px]" style={{ background: "rgba(255,255,255,.06)", color: "var(--color-text-3)" }}>
                {t.name}
              </span>
            ))}
            {post.is_nsfw && <span className="text-[9.5px] tracking-[.09em] uppercase px-[7px] py-[3px] rounded-[3px]" style={{ background: "rgba(255,86,48,.2)", color: "var(--color-ember)" }}>NSFW</span>}
            {post.is_oc   && <span className="text-[9.5px] tracking-[.09em] uppercase px-[7px] py-[3px] rounded-[3px]" style={{ background: "rgba(56,139,253,.18)", color: "#58a6ff" }}>OC</span>}
          </div>

          {/* Font-weight light on the title creates hierarchy against the bolder
              action bar and comment text below it */}
          <h1 className="font-light leading-[1.2] mt-0 mb-4" style={{ fontSize: 30, letterSpacing: "-.012em", color: "var(--color-text)", maxWidth: "28ch" }}>
            {post.title}
          </h1>

          <div className="flex items-center gap-[10px]">
            <Link href={`/u/${post.author?.username ?? ""}`} className="flex-shrink-0">
              <div className="grid place-items-center rounded-full text-white font-bold" style={{ width: 32, height: 32, background: avatarColor(post.author?.username ?? "?"), fontSize: 13 }}>
                {(post.author?.display_name ?? post.author?.username ?? "?")[0].toUpperCase()}
              </div>
            </Link>
            <div>
              <Link href={`/u/${post.author?.username ?? ""}`} className="text-[13px] font-semibold block leading-tight transition-colors" style={{ color: "var(--color-text)" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text)"}
              >
                {post.author?.display_name ?? post.author?.username ?? "unknown"}
              </Link>
              <span className="text-[11px]" style={{ color: "var(--color-text-3)" }}>
                {post.author?.title && <>{post.author.title} &nbsp;·&nbsp; </>}
                {timeAgo(post.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────────────── */}
        <div className="mb-6">
          {post.format === "link" && post.link_url && !embed && (
            <a href={post.link_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mb-4 px-4 py-[9px] rounded-[7px] text-[13px] transition-all"
              style={{ background: "var(--color-panel)", color: "var(--color-text-2)", border: "1px solid var(--color-line)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-text-3)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"; }}
            >
              <LinkIcon /> {post.link_url.replace(/^https?:\/\//, "").split("/")[0]}
            </a>
          )}

          {post.format === "showcase" && sm && (
            <div className="flex flex-wrap gap-3 mb-5">
              {sm.repo_url && (
                <a href={sm.repo_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-[7px] px-4 py-[8px] rounded-[7px] text-[13px] font-medium transition-all"
                  style={{ background: "rgba(255,46,126,.1)", border: "1px solid var(--color-accent)", color: "var(--color-accent)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,46,126,.18)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,46,126,.1)"}
                >
                  <LinkIcon /> View Repo
                </a>
              )}
              {sm.demo_url && (
                <a href={sm.demo_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-[7px] px-4 py-[8px] rounded-[7px] text-[13px] font-medium transition-all"
                  style={{ background: "rgba(56,139,253,.1)", border: "1px solid #388bfd", color: "#58a6ff" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(56,139,253,.18)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(56,139,253,.1)"}
                >
                  <LinkIcon /> Live Demo
                </a>
              )}
            </div>
          )}

          {/* Body as markdown — developers expect code blocks to work */}
          {post.body_md && <Markdown prose>{post.body_md}</Markdown>}
        </div>

        {/* ── Actions bar ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 py-4 mb-8" style={{ borderTop: "1px solid var(--color-line)", borderBottom: "1px solid var(--color-line)" }}>

          {/* Clout vote cluster — coloured when voted, neutral otherwise */}
          <div className="flex items-center gap-[6px] mr-2">
            <button
              onClick={() => handleVote(1)}
              title={currentUserId ? "Boost" : "Sign in to vote"}
              className="grid place-items-center rounded-[6px] transition-all"
              style={{ width: 32, height: 32, color: localVote === "up" ? "var(--color-accent)" : "var(--color-text-3)" }}
              onMouseEnter={e => { if (localVote !== "up") (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"; (e.currentTarget as HTMLElement).style.background = "var(--color-panel-2)"; }}
              onMouseLeave={e => { if (localVote !== "up") (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <UpIcon />
            </button>
            <span
              className="font-bold text-[18px] min-w-[32px] text-center"
              style={{ color: localVote === "up" ? "var(--color-accent)" : localVote === "down" ? "var(--color-ember)" : "var(--color-text-2)" }}
            >
              {localClout.toLocaleString()}
            </span>
            <button
              onClick={() => handleVote(-1)}
              title={currentUserId ? "Lower" : "Sign in to vote"}
              className="grid place-items-center rounded-[6px] transition-all"
              style={{ width: 32, height: 32, color: localVote === "down" ? "var(--color-ember)" : "var(--color-text-3)" }}
              onMouseEnter={e => { if (localVote !== "down") (e.currentTarget as HTMLElement).style.color = "var(--color-ember)"; (e.currentTarget as HTMLElement).style.background = "var(--color-panel-2)"; }}
              onMouseLeave={e => { if (localVote !== "down") (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <DownIcon />
            </button>
          </div>

          <a href="#comments" className="flex items-center gap-[6px] px-3 py-[6px] rounded-[6px] text-[12.5px] tracking-[.04em] transition-all"
            style={{ color: "var(--color-text-3)", border: "1px solid transparent" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
          >
            <CommentIcon /> {post.comment_count.toLocaleString()} comments
          </a>

          {currentUserId && (
            <button className="flex items-center gap-[6px] px-3 py-[6px] rounded-[6px] text-[12.5px] tracking-[.04em] transition-all" title="Save (Phase 2)"
              style={{ color: "var(--color-text-3)", border: "1px solid transparent" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
            >
              <SaveIcon /> Save
            </button>
          )}

          <button onClick={handleShare}
            className="flex items-center gap-[6px] px-3 py-[6px] rounded-[6px] text-[12.5px] tracking-[.04em] transition-all"
            style={{ color: copied ? "var(--color-accent)" : "var(--color-text-3)", border: `1px solid ${copied ? "var(--color-accent)" : "transparent"}` }}
            onMouseEnter={e => { if (!copied) { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; } }}
            onMouseLeave={e => { if (!copied) { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; } }}
          >
            <ShareIcon /> {copied ? "Copied!" : "Share"}
          </button>
        </div>

        {/* ── Comments ───────────────────────────────────────────────────────── */}
        <div id="comments">
          <h2 className="text-[13px] font-bold tracking-[.1em] uppercase mt-0 mb-5" style={{ color: "var(--color-text-3)" }}>
            {comments.length > 0 ? `${comments.length} Comment${comments.length === 1 ? "" : "s"}` : "Start the discussion"}
          </h2>

          {currentUserId ? (
            <div className="mb-8">
              <CommentForm postId={post.id} onSuccess={() => router.refresh()} />
            </div>
          ) : (
            <div className="text-center py-8 rounded-[10px] mb-8" style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}>
              <p className="text-[13px] mb-3 mt-0" style={{ color: "var(--color-text-2)" }}>Join the conversation</p>
              <Link href="/login" className="inline-block px-5 py-[8px] rounded-[6px] text-[13px] font-semibold text-white" style={{ background: "var(--color-accent)" }}>
                Sign in
              </Link>
            </div>
          )}

          {topLevel.length > 0 ? (
            <div className="flex flex-col gap-6">
              {topLevel.map(c => (
                <CommentRow key={c.id} comment={c} replies={repliesByParent[c.id] ?? []} postId={post.id} onRefresh={() => router.refresh()} />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-center py-8" style={{ color: "var(--color-text-3)" }}>No comments yet.</p>
          )}
        </div>

      </div>
      </div>
    </div>
  );
}
