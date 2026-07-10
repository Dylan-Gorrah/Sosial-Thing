"use client";

// Mini carousel for feed-card thumbnails (Explore). Lives inside a <Link>
// card, so the arrows preventDefault + stopPropagation — flipping through a
// gallery must never navigate. Single image = no controls, just the picture.

import { useRef, useState } from "react";

export default function ThumbCarousel({ images, heightClass = "" }: {
  images: string[];
  heightClass?: string;
}) {
  const [idx, setIdx] = useState(0);
  const touchX = useRef<number | null>(null);
  if (images.length === 0) return null;

  function go(e: React.MouseEvent, dir: 1 | -1) {
    e.preventDefault();
    e.stopPropagation();
    setIdx(i => (i + dir + images.length) % images.length);
  }

  // Swipe on touch devices — the rails hide on phones, so this is how mobile
  // flips through a gallery. A swipe must not trigger the card's link either.
  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null || images.length < 2) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 40) return; // a tap, not a swipe — let the link work
    e.preventDefault();
    setIdx(i => (i + (dx < 0 ? 1 : -1) + images.length) % images.length);
  }

  return (
    <div
      className={`relative overflow-hidden rounded-[10px] group/thumb ${heightClass}`}
      style={{ background: "#0a0a0e", width: "100%", height: "100%" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <img
        key={idx}
        src={images[idx]}
        alt=""
        loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />

      {images.length > 1 && (
        <>
          <button
            onClick={e => go(e, -1)}
            aria-label="Previous image"
            className="opacity-0 group-hover/thumb:opacity-100 transition-opacity"
            style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,.6)", border: "1px solid rgba(255,255,255,.18)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M15 6l-6 6 6 6"/></svg>
          </button>
          <button
            onClick={e => go(e, 1)}
            aria-label="Next image"
            className="opacity-0 group-hover/thumb:opacity-100 transition-opacity"
            style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,.6)", border: "1px solid rgba(255,255,255,.18)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>
          </button>
          {/* counter */}
          <span style={{ position: "absolute", top: 6, right: 8, background: "rgba(0,0,0,.65)", borderRadius: 4, padding: "2px 7px", color: "#fff", fontSize: 10, fontWeight: 600, letterSpacing: ".04em" }}>
            {idx + 1}/{images.length}
          </span>
        </>
      )}
    </div>
  );
}
