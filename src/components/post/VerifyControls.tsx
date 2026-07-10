"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { verifyPost, flagSlop } from "@/app/actions/clout";
import type { Post, VerifyEvidence } from "@/types";

// ── Icons ─────────────────────────────────────────────────────────────────────
const ShieldCheckIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
const CheckIcon = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 12 10 18 20 6" />
  </svg>
);
const FlagIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 21V4" />
    <path d="M4 4h12l-2 4 2 4H4" />
  </svg>
);

const VERIFIED_COLOR = "#3fb970";

// ── Chips (used in post headers + list rows) ──────────────────────────────────
export function VerifiedChip({ small = false }: { small?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-[4px] tracking-[.08em] uppercase rounded-[3px]"
      style={{
        fontSize:   small ? 9 : 9.5,
        padding:    small ? "2px 6px" : "3px 7px",
        background: "rgba(63,185,112,.13)",
        color:      VERIFIED_COLOR,
      }}
    >
      <CheckIcon size={small ? 8 : 9} />
      Verified
    </span>
  );
}

export function SlopChip({ small = false }: { small?: boolean }) {
  return (
    <span
      className="inline-flex items-center tracking-[.08em] uppercase rounded-[3px]"
      style={{
        fontSize:   small ? 9 : 9.5,
        padding:    small ? "2px 6px" : "3px 7px",
        background: "rgba(255,255,255,.05)",
        color:      "var(--color-text-3)",
        border:     "1px dashed var(--color-line)",
      }}
    >
      Community flagged
    </span>
  );
}

// ── Evidence options ──────────────────────────────────────────────────────────
const EVIDENCE: { value: VerifyEvidence; label: string }[] = [
  { value: "ran_demo",        label: "I ran the demo" },
  { value: "read_code",       label: "I read the code" },
  { value: "watched_it_work", label: "I watched it work" },
  { value: "saw_in_person",   label: "I saw it in person" },
];

// ── Verify + flag cluster for the post actions bar ────────────────────────────
interface Props {
  post: Post;
  onVerified?: () => void;
}

export default function VerifyControls({ post, onVerified }: Props) {
  const [viewerId,    setViewerId]    = useState<string | null>(null);
  const [viewerClout, setViewerClout] = useState(0);
  const [verifyCount, setVerifyCount] = useState(0);
  const [iVerified,   setIVerified]   = useState(false);
  const [iFlagged,    setIFlagged]    = useState(false);
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [flagArmed,   setFlagArmed]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [, startTransition]           = useTransition();
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sb = createClient();
    let cancelled = false;
    async function load() {
      const { data: { user } } = await sb.auth.getUser();
      const [verRes, profileRes, flagRes] = await Promise.all([
        sb.from("post_verifications").select("verifier_id").eq("post_id", post.id),
        user ? sb.from("profiles").select("clout_score").eq("id", user.id).single() : Promise.resolve({ data: null }),
        user ? sb.from("slop_flags").select("id").eq("post_id", post.id).eq("flagger_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      const vers = verRes.data ?? [];
      setViewerId(user?.id ?? null);
      setViewerClout(profileRes.data?.clout_score ?? 0);
      setVerifyCount(vers.length);
      setIVerified(!!user && vers.some((v: any) => v.verifier_id === user.id));
      setIFlagged(!!flagRes.data);
    }
    load();
    return () => { cancelled = true; };
  }, [post.id]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Clear the armed flag state if the pointer wanders off for a while
  useEffect(() => {
    if (!flagArmed) return;
    const t = setTimeout(() => setFlagArmed(false), 4000);
    return () => clearTimeout(t);
  }, [flagArmed]);

  const ownPost     = viewerId === post.user_id;
  const contributor = viewerClout >= 500;
  const canAct      = !!viewerId && !ownPost && contributor;
  const inSlopState = post.slop_status === "flagged";

  function pickEvidence(evidence: VerifyEvidence) {
    setPickerOpen(false);
    setIVerified(true);
    setVerifyCount(c => c + 1);
    setError(null);
    startTransition(async () => {
      const res = await verifyPost(post.id, evidence);
      if (res.error) {
        setIVerified(false);
        setVerifyCount(c => c - 1);
        setError(res.error);
      } else {
        onVerified?.();
      }
    });
  }

  function handleFlag() {
    if (!flagArmed) { setFlagArmed(true); return; }
    setFlagArmed(false);
    setIFlagged(true);
    setError(null);
    startTransition(async () => {
      const res = await flagSlop(post.id);
      if (res.error) {
        setIFlagged(false);
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-[14px]">
      {/* Verify */}
      <div className="relative" ref={pickerRef}>
        <button
          title={
            !viewerId    ? "Sign in to verify" :
            ownPost      ? "You can't verify your own post" :
            !contributor ? "Contributor status (500+ clout) required" :
            iVerified    ? "You verified this build" : "Vouch that this build is real"
          }
          disabled={!canAct || iVerified || inSlopState}
          onClick={() => setPickerOpen(o => !o)}
          className="flex items-center gap-[5px] transition-colors"
          style={{
            fontSize:      11,
            letterSpacing: ".05em",
            color:  iVerified ? VERIFIED_COLOR : "var(--color-text-3)",
            cursor: canAct && !iVerified && !inSlopState ? "pointer" : "default",
            opacity: (!canAct && !iVerified) || inSlopState ? 0.55 : 1,
          }}
          onMouseEnter={e => { if (canAct && !iVerified && !inSlopState) (e.currentTarget as HTMLElement).style.color = VERIFIED_COLOR; }}
          onMouseLeave={e => { if (!iVerified) (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
        >
          <ShieldCheckIcon />
          <span className="uppercase">{iVerified ? "Verified by you" : "Verify"}</span>
          {verifyCount > 0 && <span className="tabular-nums" style={{ fontWeight: 700 }}>{verifyCount}</span>}
        </button>

        {pickerOpen && canAct && !iVerified && (
          <div
            className="absolute left-0 bottom-[calc(100%+8px)] rounded-[8px] overflow-hidden z-50"
            style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)", minWidth: 190, boxShadow: "0 8px 24px rgba(0,0,0,.3)" }}
          >
            <div className="px-[13px] py-[8px] uppercase tracking-[.08em]" style={{ fontSize: 9.5, color: "var(--color-text-3)", borderBottom: "1px solid var(--color-line)" }}>
              How did you check it?
            </div>
            {EVIDENCE.map(ev => (
              <button
                key={ev.value}
                onClick={() => pickEvidence(ev.value)}
                className="flex w-full px-[13px] py-[9px] text-left transition-all"
                style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-text-2)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(63,185,112,.1)"; (e.currentTarget as HTMLElement).style.color = VERIFIED_COLOR; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"; }}
              >
                {ev.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Slop flag */}
      {canAct && !inSlopState && !post.verified && (
        <button
          title={iFlagged ? "You flagged this as low-effort" : "Flag as mass-produced / low-effort"}
          disabled={iFlagged}
          onClick={handleFlag}
          className="flex items-center gap-[5px] transition-colors"
          style={{
            fontSize:      11,
            letterSpacing: ".05em",
            color:  iFlagged || flagArmed ? "var(--color-ember)" : "var(--color-text-3)",
            cursor: iFlagged ? "default" : "pointer",
          }}
          onMouseEnter={e => { if (!iFlagged) (e.currentTarget as HTMLElement).style.color = "var(--color-ember)"; }}
          onMouseLeave={e => { if (!iFlagged && !flagArmed) (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
        >
          <FlagIcon />
          <span className="uppercase">{iFlagged ? "Flagged" : flagArmed ? "Confirm flag?" : "Slop"}</span>
        </button>
      )}

      {error && (
        <span style={{ fontSize: 10.5, color: "var(--color-ember)" }}>{error}</span>
      )}
    </div>
  );
}
