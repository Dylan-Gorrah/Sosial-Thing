"use client";

import { useEffect, useState } from "react";

// ── Embed detection ───────────────────────────────────────────────────────────
export type EmbedResult =
  | { type: "youtube"; id: string; short: boolean }
  | { type: "vimeo"; id: string }
  | null;

export function detectEmbed(url: string): EmbedResult {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    if (host === "youtube.com" && u.pathname.startsWith("/shorts/")) {
      const id = u.pathname.split("/shorts/")[1]?.split("?")[0];
      if (id) return { type: "youtube", id, short: true };
    }
    if (host === "youtube.com") {
      const id = u.searchParams.get("v");
      if (id) return { type: "youtube", id, short: false };
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("?")[0];
      if (id) return { type: "youtube", id, short: false };
    }
    if (host === "vimeo.com") {
      const id = u.pathname.slice(1).split("?")[0];
      if (/^\d+$/.test(id)) return { type: "vimeo", id };
    }
  } catch { /* invalid URL */ }
  return null;
}

export function getYoutubeId(url: string): string | null {
  const embed = detectEmbed(url);
  return embed?.type === "youtube" ? embed.id : null;
}

// ── Facade player — thumbnail + play button, iframe loads on click ────────────
export function VideoPlayer({ embed }: { embed: EmbedResult }) {
  const [active, setActive] = useState(false);
  const [vimeoThumb, setVimeoThumb] = useState<string | null>(null);
  const vimeoId = embed?.type === "vimeo" ? embed.id : null;

  useEffect(() => {
    if (!vimeoId) return;
    let cancelled = false;
    fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${vimeoId}`)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (!cancelled && data?.thumbnail_url) setVimeoThumb(data.thumbnail_url); })
      .catch(() => { /* fall back to plain black facade */ });
    return () => { cancelled = true; };
  }, [vimeoId]);

  if (!embed) return null;

  const isShort = embed.type === "youtube" && embed.short;
  const thumbUrl = embed.type === "youtube"
    ? `https://i.ytimg.com/vi/${embed.id}/hqdefault.jpg`
    : vimeoThumb;
  const iframeSrc = embed.type === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${embed.id}?rel=0&autoplay=1`
    : `https://player.vimeo.com/video/${embed.id}?dnt=1&autoplay=1`;

  return (
    <div className="w-full flex justify-center" style={{ background: "#000" }}>
      <div
        style={{
          width: "100%",
          maxWidth: isShort ? 340 : "100%",
          aspectRatio: isShort ? "9/16" : "16/9",
          position: "relative",
          background: "#000",
        }}
      >
        {!active ? (
          <button
            onClick={() => setActive(true)}
            className="absolute inset-0 w-full h-full p-0 border-none cursor-pointer"
            aria-label="Play video"
            style={{ background: "none" }}
          >
            {thumbUrl && (
              <img
                src={thumbUrl}
                alt=""
                className="w-full h-full"
                style={{ objectFit: "cover", display: "block" }}
              />
            )}
            {/* Red play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div style={{ width: 68, height: 48, background: "#ff0000", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.9 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
              </div>
            </div>
          </button>
        ) : (
          <iframe
            src={iframeSrc}
            className="absolute inset-0 w-full h-full"
            style={{ border: "none" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            title="Embedded video"
          />
        )}
      </div>
    </div>
  );
}
