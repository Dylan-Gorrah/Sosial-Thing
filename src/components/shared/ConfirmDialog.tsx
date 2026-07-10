"use client";

import { useEffect } from "react";

const WarnIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busyLabel?: string;
  tone?: "danger" | "default";
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busyLabel = "Working…",
  tone = "danger",
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Esc cancels (unless an action is in flight)
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const accent     = tone === "danger" ? "var(--color-ember)" : "var(--color-accent)";
  const accentSoft = tone === "danger" ? "rgba(255,86,48,0.14)" : "var(--color-accent-soft)";

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Blurred backdrop */}
      <div
        onClick={() => { if (!busy) onCancel(); }}
        className="absolute inset-0"
        style={{
          background: "rgba(6,6,8,0.6)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          animation: "overlayFade .18s ease both",
        }}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-[380px] rounded-[16px] overflow-hidden"
        style={{
          background: "var(--color-panel)",
          border: "1px solid var(--color-line-2)",
          boxShadow: "0 24px 60px rgba(0,0,0,.55)",
          animation: "dialogPop .22s cubic-bezier(.4,0,.2,1) both",
        }}
      >
        <div className="flex flex-col items-center text-center px-7 pt-8 pb-6">
          <div
            className="grid place-items-center rounded-full mb-4"
            style={{ width: 52, height: 52, background: accentSoft, color: accent }}
          >
            <WarnIcon />
          </div>
          <h2 className="m-0 mb-2" style={{ fontSize: 17, fontWeight: 600, color: "var(--color-text)" }}>
            {title}
          </h2>
          {message && (
            <p className="m-0" style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--color-text-2)", maxWidth: 300 }}>
              {message}
            </p>
          )}
          {error && (
            <p className="mt-3 mb-0" style={{ fontSize: 12.5, color: "var(--color-ember)" }}>
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3 px-7 pb-7">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-[10px] rounded-[8px] text-[13px] font-medium transition-all"
            style={{ border: "1px solid var(--color-line-2)", color: "var(--color-text-2)", background: "transparent", cursor: busy ? "default" : "pointer" }}
            onMouseEnter={e => { if (!busy) { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-text-3)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line-2)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"; }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-[10px] rounded-[8px] text-[13px] font-semibold text-white transition-all"
            style={{ background: accent, opacity: busy ? 0.75 : 1, cursor: busy ? "default" : "pointer" }}
            onMouseEnter={e => { if (!busy) (e.currentTarget as HTMLElement).style.filter = "brightness(1.08)"; }}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.filter = "none"}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
