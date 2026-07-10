"use client";

// Shared Reddit-style image carousel. Extracted so the standalone post page
// (/post/[id]) can show galleries too — previously only the feed's reader
// pane rendered them (PostDetail has a local copy; unify on this one later).

import { useState, useEffect } from "react";
import type { PostImage } from "@/types";

export default function ImageCarousel({ images }: { images: PostImage[] }) {
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
