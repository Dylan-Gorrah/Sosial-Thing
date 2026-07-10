"use client";

import { useState } from "react";
import { fileReport, type ReportReason } from "@/app/actions/reports";

// Report a post or a comment. Pass exactly one of postId / commentId.
// Routing to the room owner (or site admin) happens server-side.

const REASONS: { value: ReportReason; label: string; hint: string }[] = [
  { value: "spam",        label: "Spam",        hint: "Ads, junk, repeated posting" },
  { value: "abuse",       label: "Abuse",       hint: "Harassment, hate, threats" },
  { value: "stolen_work", label: "Stolen work", hint: "Claiming someone else's project" },
  { value: "other",       label: "Other",       hint: "Anything else — explain below" },
];

const FlagIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
  </svg>
);

interface Props {
  open: boolean;
  onClose: () => void;
  postId?: string;
  commentId?: string;
}

export default function ReportModal({ open, onClose, postId, commentId }: Props) {
  const [reason, setReason]   = useState<ReportReason | null>(null);
  const [note, setNote]       = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [sent, setSent]       = useState(false);

  if (!open) return null;

  async function submit() {
    if (!reason || sending) return;
    setSending(true);
    setError(null);
    const res = await fileReport({ postId, commentId, reason, note });
    setSending(false);
    if (res.error) { setError(res.error); return; }
    setSent(true);
    setTimeout(() => {
      setSent(false); setReason(null); setNote("");
      onClose();
    }, 1200);
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="relative w-full max-w-[400px] rounded-[10px] p-6"
        style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
      >
        {sent ? (
          <div className="flex flex-col items-center gap-2 py-6" style={{ color: "var(--color-text-2)" }}>
            <FlagIcon />
            <p className="text-[13.5px] m-0">Report sent. Thanks for keeping things clean.</p>
          </div>
        ) : (
          <>
            <h2 className="text-[15px] font-semibold m-0 mb-1" style={{ color: "var(--color-text)" }}>
              Report {commentId ? "comment" : "post"}
            </h2>
            <p className="text-[12px] m-0 mb-4" style={{ color: "var(--color-text-3)" }}>
              Goes straight to whoever moderates this space.
            </p>

            <div className="flex flex-col gap-2 mb-4">
              {REASONS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className="flex items-center gap-3 px-3 py-[9px] rounded-[6px] text-left transition-all"
                  style={
                    reason === r.value
                      ? { border: "1px solid var(--color-accent)", background: "var(--color-accent-soft)" }
                      : { border: "1px solid var(--color-line)", background: "transparent" }
                  }
                >
                  <span
                    className="rounded-full flex-shrink-0"
                    style={{ width: 8, height: 8, background: reason === r.value ? "var(--color-accent)" : "var(--color-line)" }}
                  />
                  <span className="flex flex-col">
                    <span className="text-[13px] font-medium" style={{ color: reason === r.value ? "var(--color-accent)" : "var(--color-text)" }}>
                      {r.label}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--color-text-3)" }}>{r.hint}</span>
                  </span>
                </button>
              ))}
            </div>

            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Anything that helps (optional)"
              className="w-full rounded-[6px] text-[13px] px-3 py-[9px] outline-none resize-none mb-3"
              style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)", color: "var(--color-text)" }}
            />

            {error && <p className="text-[12.5px] m-0 mb-3" style={{ color: "var(--color-ember)" }}>{error}</p>}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-[8px] rounded-[6px] text-[13px] font-medium"
                style={{ border: "1px solid var(--color-line)", color: "var(--color-text-2)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!reason || sending}
                className="px-5 py-[8px] rounded-[6px] text-[13px] font-semibold text-white transition-all"
                style={{ background: "var(--color-ember)", opacity: !reason || sending ? 0.55 : 1 }}
              >
                {sending ? "Sending…" : "Report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
