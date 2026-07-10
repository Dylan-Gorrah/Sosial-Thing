"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { toggleBookmark } from "@/app/actions/posts";

const SaveIcon = ({ filled, size = 15 }: { filled: boolean; size?: number }) =>
  filled
    ? <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" strokeLinejoin="round"><path d="M6 4h12v16l-6-4-6 4z" /></svg>
    : <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M6 4h12v16l-6-4-6 4z" /></svg>;

interface Props {
  postId: string;
  variant?: "ghost" | "pill" | "icon";
}

// Self-contained save toggle for the post detail pane + post page.
// Fetches its own bookmark state (RLS: users only see their own rows).
export default function SaveButton({ postId, variant = "ghost" }: Props) {
  const [saved, setSaved]   = useState(false);
  const [, startTransition] = useTransition();
  // Once the user toggles, the (possibly still in-flight) initial fetch
  // must not overwrite their choice.
  const touched = useRef(false);

  useEffect(() => {
    const sb = createClient();
    let cancelled = false;
    touched.current = false;
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) return;
      const { data } = await sb
        .from("bookmarks")
        .select("id")
        .eq("post_id", postId)
        .maybeSingle();
      if (!cancelled && !touched.current) setSaved(!!data);
    });
    return () => { cancelled = true; };
  }, [postId]);

  function toggle() {
    touched.current = true;
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      const res = await toggleBookmark(postId);
      if (res.error) setSaved(!next); // e.g. not signed in
    });
  }

  if (variant === "icon") {
    return (
      <button
        onClick={e => { e.stopPropagation(); e.preventDefault(); toggle(); }}
        title={saved ? "Unsave" : "Save"}
        className="transition-colors"
        style={{ color: saved ? "var(--color-accent)" : "var(--color-text-3)" }}
        onMouseEnter={e => { if (!saved) (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"; }}
        onMouseLeave={e => { if (!saved) (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
      >
        <SaveIcon filled={saved} size={13} />
      </button>
    );
  }

  if (variant === "pill") {
    return (
      <button
        onClick={toggle}
        title={saved ? "Unsave" : "Save"}
        className="flex items-center gap-[6px] px-3 py-[6px] rounded-[6px] text-[12.5px] tracking-[.04em] transition-all"
        style={{
          color:  saved ? "var(--color-accent)" : "var(--color-text-3)",
          border: `1px solid ${saved ? "var(--color-accent)" : "transparent"}`,
        }}
        onMouseEnter={e => { if (!saved) { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; } }}
        onMouseLeave={e => { if (!saved) { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; } }}
      >
        <SaveIcon filled={saved} size={16} /> {saved ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      title={saved ? "Unsave" : "Save"}
      className="flex items-center gap-[5px] transition-colors"
      style={{ color: saved ? "var(--color-accent)" : "var(--color-text-3)", fontSize: 11, letterSpacing: ".05em" }}
      onMouseEnter={e => { if (!saved) (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"; }}
      onMouseLeave={e => { if (!saved) (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
    >
      <SaveIcon filled={saved} />
      <span className="uppercase tracking-[.05em]">{saved ? "Saved" : "Save"}</span>
    </button>
  );
}
