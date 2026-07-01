"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { addComment } from "@/app/actions/comments";
import type { Comment } from "@/types";

// ── Icons ─────────────────────────────────────────────────────────────────────
const UpIcon    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 14 6-6 6 6"/></svg>;
const ReplyIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17l-4-4 4-4"/><path d="M20 18v-2a4 4 0 0 0-4-4H5"/></svg>;

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Tree builder ──────────────────────────────────────────────────────────────
interface CommentNode extends Comment {
  children: CommentNode[];
}

function buildTree(flat: Comment[]): CommentNode[] {
  const byId: Record<string, CommentNode> = {};
  const roots: CommentNode[] = [];
  for (const c of flat) byId[c.id] = { ...c, children: [] };
  for (const c of flat) {
    if (c.parent_id && byId[c.parent_id]) byId[c.parent_id].children.push(byId[c.id]);
    else roots.push(byId[c.id]);
  }
  return roots;
}

// ── Reply box ─────────────────────────────────────────────────────────────────
interface ReplyBoxProps {
  postId: string;
  parentId: string | null;
  autofocus?: boolean;
  onDone: (c: Comment) => void;
  onCancel?: () => void;
  currentUserId: string | null;
}

function ReplyBox({ postId, parentId, autofocus, onDone, onCancel, currentUserId }: ReplyBoxProps) {
  const [text,    setText]    = useState("");
  const [error,   setError]   = useState<string | null>(null);
  const [pending, startTrans] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (autofocus) ref.current?.focus(); }, [autofocus]);

  if (!currentUserId) {
    return (
      <p style={{ fontSize: 12.5, color: "var(--color-text-3)" }}>
        <Link href="/login" style={{ color: "var(--color-accent)" }}>Sign in</Link> to comment.
      </p>
    );
  }

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    const fd = new FormData();
    fd.set("post_id",   postId);
    fd.set("content",   trimmed);
    if (parentId) fd.set("parent_id", parentId);
    startTrans(async () => {
      const res = await addComment(null, fd);
      if (res.error) { setError(res.error); return; }
      setText("");
      // Optimistic: create a local comment object to show immediately
      const supabase = createClient();
      const { data: profile } = await supabase
        .from("profiles").select("id,username,display_name,avatar_url,clout_tier").eq("id", currentUserId).single();
      onDone({
        id:         crypto.randomUUID(),
        post_id:    postId,
        user_id:    currentUserId,
        content:    trimmed,
        like_count: 0,
        parent_id:  parentId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author:     profile ?? undefined,
        replies:    [],
      } as Comment);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={parentId ? "Write a reply…" : "Add a comment…"}
        rows={3}
        className="w-full resize-none rounded-[6px] px-3 py-[9px] outline-none transition-colors text-[13.5px]"
        style={{
          background:   "var(--color-panel)",
          border:       "1px solid var(--color-line)",
          color:        "var(--color-text)",
          lineHeight:   1.5,
        }}
        onFocus={e  => { e.currentTarget.style.borderColor = "var(--color-accent)"; }}
        onBlur={e   => { e.currentTarget.style.borderColor = "var(--color-line)"; }}
        onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
      />
      {error && <p style={{ fontSize: 11.5, color: "var(--color-ember)" }}>{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={pending || !text.trim()}
          className="px-4 py-[6px] rounded-[5px] font-semibold transition-opacity text-[12.5px]"
          style={{ background: "var(--color-accent)", color: "#fff", opacity: (pending || !text.trim()) ? 0.5 : 1 }}
        >
          {pending ? "Posting…" : parentId ? "Reply" : "Comment"}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-[6px] rounded-[5px] text-[12.5px] transition-colors"
            style={{ color: "var(--color-text-3)" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"}
          >
            Cancel
          </button>
        )}
        <span style={{ fontSize: 11, color: "var(--color-text-3)", marginLeft: "auto" }}>
          Ctrl+Enter to post
        </span>
      </div>
    </div>
  );
}

// ── Single comment row ────────────────────────────────────────────────────────
interface CommentRowProps {
  node:          CommentNode;
  depth:         number;
  postId:        string;
  currentUserId: string | null;
  onAddReply:    (parentId: string, c: Comment) => void;
}

function CommentRow({ node, depth, postId, currentUserId, onAddReply }: CommentRowProps) {
  const [replying,    setReplying]    = useState(false);
  const [localLikes,  setLocalLikes]  = useState(node.like_count);

  return (
    <div
      style={{
        paddingLeft: depth > 0 ? 16 : 0,
        borderLeft:  depth > 0 ? "2px solid var(--color-line)" : "none",
        marginLeft:  depth > 0 ? 6 : 0,
      }}
    >
      {/* Meta */}
      <div className="flex items-center gap-[7px] mb-1">
        <Link
          href={`/u/${node.author?.username ?? ""}`}
          className="font-semibold text-[12px] transition-colors"
          style={{ color: "var(--color-accent)" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = ".75"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
        >
          {node.author?.username ?? "unknown"}
        </Link>
        <span className="uppercase tracking-[.06em]" style={{ fontSize: 9.5, color: "var(--color-text-3)" }}>
          {timeAgo(node.created_at)}
        </span>
      </div>

      {/* Body */}
      <p
        className="m-0 mb-2 whitespace-pre-wrap leading-[1.55]"
        style={{ fontSize: 13.5, color: "var(--color-text-2)" }}
      >
        {node.content}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-[10px] mb-3">
        <button
          onClick={() => setLocalLikes(l => l + 1)}
          className="flex items-center gap-[4px] transition-colors"
          style={{ fontSize: 11, color: "var(--color-text-3)" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"}
        >
          <UpIcon />
          <span>{localLikes > 0 ? localLikes : ""}</span>
        </button>

        {depth < 2 && (
          <button
            onClick={() => setReplying(r => !r)}
            className="flex items-center gap-[4px] transition-colors uppercase tracking-[.05em]"
            style={{ fontSize: 10.5, color: replying ? "var(--color-accent)" : "var(--color-text-3)" }}
            onMouseEnter={e => { if (!replying) (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"; }}
            onMouseLeave={e => { if (!replying) (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
          >
            <ReplyIcon /> Reply
          </button>
        )}
      </div>

      {/* Inline reply box */}
      {replying && (
        <div className="mb-3">
          <ReplyBox
            postId={postId}
            parentId={node.id}
            autofocus
            currentUserId={currentUserId}
            onDone={c => { onAddReply(node.id, c); setReplying(false); }}
            onCancel={() => setReplying(false)}
          />
        </div>
      )}

      {/* Children */}
      {node.children.map(child => (
        <CommentRow
          key={child.id}
          node={child}
          depth={depth + 1}
          postId={postId}
          currentUserId={currentUserId}
          onAddReply={onAddReply}
        />
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
interface CommentSectionProps {
  postId: string;
  commentCount: number;
}

export default function CommentSection({ postId, commentCount }: CommentSectionProps) {
  const [roots,         setRoots]         = useState<CommentNode[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Resolve viewer
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  // Fetch comments
  useEffect(() => {
    setLoading(true);
    createClient()
      .from("comments")
      .select("*, author:profiles(id, username, display_name, avatar_url, clout_tier)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        setRoots(buildTree((data ?? []) as Comment[]));
        setLoading(false);
      });
  }, [postId]);

  function handleTopLevel(c: Comment) {
    setRoots(prev => [...prev, { ...c, children: [] } as CommentNode]);
  }

  function handleReply(parentId: string, c: Comment) {
    function insert(nodes: CommentNode[]): CommentNode[] {
      return nodes.map(n => {
        if (n.id === parentId) return { ...n, children: [...n.children, { ...c, children: [] } as CommentNode] };
        return { ...n, children: insert(n.children) };
      });
    }
    setRoots(prev => insert(prev));
  }

  return (
    <div>
      {/* Reply box (top-level) */}
      <div className="mb-6">
        <ReplyBox
          postId={postId}
          parentId={null}
          currentUserId={currentUserId}
          onDone={handleTopLevel}
        />
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="flex flex-col gap-4">
          {[80, 60, 90].map((w, i) => (
            <div key={i}>
              <div className="h-3 rounded mb-2 animate-pulse" style={{ background: "var(--color-panel)", width: "35%" }} />
              <div className="h-3 rounded mb-1 animate-pulse" style={{ background: "var(--color-panel)", width: `${w}%` }} />
              <div className="h-3 rounded animate-pulse" style={{ background: "var(--color-panel)", width: "50%" }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && roots.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--color-text-3)" }}>No comments yet. Be the first.</p>
      )}

      {/* Comment tree */}
      {!loading && roots.map(node => (
        <CommentRow
          key={node.id}
          node={node}
          depth={0}
          postId={postId}
          currentUserId={currentUserId}
          onAddReply={handleReply}
        />
      ))}
    </div>
  );
}
