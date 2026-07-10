"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { resolveReport, removePostAction, blockMemberAction } from "@/app/actions/reports";

// The mod queue: see a report, judge it, act, done. Three actions max per
// row — resolve, dismiss, and (for posts still up) remove. Ban lives behind
// remove so the common path stays two clicks.

export type ModReport = {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  room_id: string | null;
  reason: string;
  note: string | null;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
  post: { id: string; title: string; user_id: string; removed_at: string | null; author: { username: string } | null } | null;
  comment: { id: string; content: string; post_id: string; user_id: string; author: { username: string } | null } | null;
  room: { id: string; name: string } | null;
  reporter: { username: string } | null;
};

const REASON_LABEL: Record<string, string> = {
  spam: "Spam", abuse: "Abuse", stolen_work: "Stolen work", other: "Other",
};

const ShieldIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10z"/>
  </svg>
);

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60)     return "just now";
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ReportRow({ report, onHandled }: { report: ModReport; onHandled: (id: string) => void }) {
  const [busy, startAction] = useTransition();
  const [error, setError]   = useState<string | null>(null);
  const [banAsk, setBanAsk] = useState(false);

  const targetPostId = report.post_id ?? report.comment?.post_id ?? null;
  const authorName   = report.post?.author?.username ?? report.comment?.author?.username ?? "unknown";
  const authorId     = report.post?.user_id ?? report.comment?.user_id ?? null;

  function act(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startAction(async () => {
      const res = await fn();
      if (res.error) { setError(res.error); return; }
      onHandled(report.id);
    });
  }

  return (
    <div className="rounded-[10px] p-4" style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}>
      {/* Reason + where it came from */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[10px] tracking-[.08em] uppercase px-[8px] py-[3px] rounded-[3px] font-semibold"
          style={{ background: "rgba(255,86,48,.14)", color: "var(--color-ember)" }}>
          {REASON_LABEL[report.reason] ?? report.reason}
        </span>
        <span className="text-[10px] tracking-[.08em] uppercase px-[8px] py-[3px] rounded-[3px] font-semibold"
          style={{ background: "var(--color-panel-2)", color: "var(--color-text-3)" }}>
          {report.comment_id ? "Comment" : "Post"}
        </span>
        {report.room && (
          <span className="text-[11px]" style={{ color: "var(--color-text-3)" }}>in {report.room.name}</span>
        )}
        <span className="text-[11px] ml-auto" style={{ color: "var(--color-text-3)" }}>
          {timeAgo(report.created_at)} · by {report.reporter?.username ?? "unknown"}
        </span>
      </div>

      {/* What was reported */}
      <div className="mb-3">
        {report.comment ? (
          <p className="text-[13px] m-0 leading-relaxed" style={{ color: "var(--color-text-2)" }}>
            <span style={{ color: "var(--color-text-3)" }}>{authorName}: </span>
            &ldquo;{report.comment.content.length > 140 ? report.comment.content.slice(0, 140) + "…" : report.comment.content}&rdquo;
          </p>
        ) : report.post ? (
          <p className="text-[13.5px] font-medium m-0" style={{ color: "var(--color-text)" }}>
            {report.post.title}
            <span className="font-normal text-[12px]" style={{ color: "var(--color-text-3)" }}> — by {authorName}</span>
            {report.post.removed_at && (
              <span className="text-[11px] ml-2" style={{ color: "var(--color-ember)" }}>already removed</span>
            )}
          </p>
        ) : (
          <p className="text-[13px] m-0" style={{ color: "var(--color-text-3)" }}>Content no longer exists.</p>
        )}
        {report.note && (
          <p className="text-[12px] m-0 mt-1 italic" style={{ color: "var(--color-text-3)" }}>&ldquo;{report.note}&rdquo;</p>
        )}
      </div>

      {error && <p className="text-[12px] m-0 mb-2" style={{ color: "var(--color-ember)" }}>{error}</p>}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {targetPostId && (
          <Link href={`/post/${targetPostId}`}
            className="px-3 py-[6px] rounded-[6px] text-[12px] font-medium"
            style={{ border: "1px solid var(--color-line)", color: "var(--color-text-2)" }}>
            View
          </Link>
        )}

        {report.post_id && report.post && !report.post.removed_at && (
          <button
            disabled={busy}
            onClick={() => act(async () => {
              const r = await removePostAction(report.post_id!, `Report: ${report.reason}`);
              if (r.error) return r;
              return resolveReport(report.id, "resolved");
            })}
            className="px-3 py-[6px] rounded-[6px] text-[12px] font-semibold text-white"
            style={{ background: "var(--color-ember)", opacity: busy ? 0.6 : 1 }}
          >
            Remove post
          </button>
        )}

        <button
          disabled={busy}
          onClick={() => act(() => resolveReport(report.id, "resolved"))}
          className="px-3 py-[6px] rounded-[6px] text-[12px] font-medium"
          style={{ border: "1px solid var(--color-line)", color: "var(--color-text-2)", opacity: busy ? 0.6 : 1 }}
        >
          Resolve
        </button>

        <button
          disabled={busy}
          onClick={() => act(() => resolveReport(report.id, "dismissed"))}
          className="px-3 py-[6px] rounded-[6px] text-[12px] font-medium"
          style={{ border: "1px solid var(--color-line)", color: "var(--color-text-3)", opacity: busy ? 0.6 : 1 }}
        >
          Dismiss
        </button>

        {/* Ban — room reports only, double-tap to confirm */}
        {report.room_id && authorId && (
          <button
            disabled={busy}
            onClick={() => {
              if (!banAsk) { setBanAsk(true); setTimeout(() => setBanAsk(false), 3000); return; }
              act(async () => {
                const r = await blockMemberAction(report.room_id!, authorId, `Report: ${report.reason}`);
                if (r.error) return r;
                return resolveReport(report.id, "resolved");
              });
            }}
            className="px-3 py-[6px] rounded-[6px] text-[12px] font-medium ml-auto"
            style={{
              border: `1px solid ${banAsk ? "var(--color-ember)" : "var(--color-line)"}`,
              color: banAsk ? "var(--color-ember)" : "var(--color-text-3)",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {banAsk ? "Tap again to ban" : `Ban ${authorName}`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ModQueueClient({ reports: initial, canModerate }: {
  reports: ModReport[];
  canModerate: boolean;
}) {
  const [reports, setReports] = useState(initial);

  const open    = reports.filter(r => r.status === "open");
  const handled = reports.filter(r => r.status !== "open");

  function markHandled(id: string) {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: "resolved" as const } : r));
  }

  return (
    <div className="h-full overflow-y-auto scroll" style={{ background: "var(--color-bg)" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px 64px" }}>

        <h1 className="text-[20px] font-semibold m-0 mb-1" style={{ color: "var(--color-text)", letterSpacing: "-.01em" }}>
          Mod queue
        </h1>
        <p className="text-[13px] m-0 mb-8" style={{ color: "var(--color-text-3)" }}>
          Reports on things you moderate. See it, judge it, act — done.
        </p>

        {!canModerate ? (
          <div className="flex flex-col items-center gap-3 py-20" style={{ color: "var(--color-text-3)" }}>
            <ShieldIcon />
            <p className="text-[13px] m-0">Nothing to moderate — this queue belongs to room owners.</p>
          </div>
        ) : open.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20" style={{ color: "var(--color-text-3)" }}>
            <ShieldIcon />
            <p className="text-[13px] m-0">All clear. No open reports.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {open.map(r => <ReportRow key={r.id} report={r} onHandled={markHandled} />)}
          </div>
        )}

        {handled.length > 0 && (
          <p className="text-[12px] mt-8 mb-0 text-center" style={{ color: "var(--color-text-3)" }}>
            {handled.length} report{handled.length === 1 ? "" : "s"} handled recently.
          </p>
        )}
      </div>
    </div>
  );
}
