"use client";

// Click-to-load live demo preview. When a showcase post's demo URL points at a
// trusted static host (GitHub Pages, Vercel, Netlify, Cloudflare Pages), we
// offer to render the actual site in a sandboxed iframe — the project itself,
// right there in the post, same facade pattern as the YouTube player.
//
// Security rules (deliberate, don't loosen casually):
// - https only, allowlisted hosts only — arbitrary iframes are an attack surface
// - click-to-load — nothing external loads until the reader asks for it
// - sandbox: scripts + same-origin (needed by real SPAs), but no top-navigation,
//   no popups, no downloads. The embedded site can't navigate this page away.
// Many sites block framing via X-Frame-Options/CSP — the "open in new tab"
// escape hatch is always shown alongside for that reason.

import { useState } from "react";

const TRUSTED_SUFFIXES = [".github.io", ".vercel.app", ".netlify.app", ".pages.dev"];

export function isEmbeddableDemo(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return TRUSTED_SUFFIXES.some(s => u.hostname.endsWith(s));
  } catch {
    return false;
  }
}

const PlayIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>
  </svg>
);
const ExternalIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

export default function DemoPreview({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);
  if (!isEmbeddableDemo(url)) return null;

  const host = (() => { try { return new URL(url).hostname; } catch { return url; } })();

  return (
    <div className="mb-5 rounded-[10px] overflow-hidden" style={{ border: "1px solid var(--color-line)" }}>
      {/* Header strip — always visible, with the escape hatch for sites that block framing */}
      <div className="flex items-center justify-between px-4 py-[8px]" style={{ background: "var(--color-panel)", borderBottom: loaded ? "1px solid var(--color-line)" : "none" }}>
        <span className="text-[11px] tracking-[.06em] uppercase font-semibold" style={{ color: "var(--color-text-3)" }}>
          Live demo · {host}
        </span>
        <a
          href={url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-[5px] text-[11.5px] transition-colors"
          style={{ color: "var(--color-text-3)" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"}
        >
          <ExternalIcon /> Open in new tab
        </a>
      </div>

      {loaded ? (
        <iframe
          src={url}
          title={`Live demo — ${host}`}
          sandbox="allow-scripts allow-same-origin allow-forms"
          referrerPolicy="no-referrer"
          loading="lazy"
          style={{ width: "100%", height: 480, border: "none", display: "block", background: "#fff" }}
        />
      ) : (
        <button
          onClick={() => setLoaded(true)}
          className="w-full flex flex-col items-center justify-center gap-2 transition-all cursor-pointer"
          style={{ height: 180, background: "var(--color-panel-2)", border: "none", color: "var(--color-text-2)" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"}
        >
          <PlayIcon />
          <span className="text-[13px] font-medium">Load the live demo right here</span>
          <span className="text-[11px]" style={{ color: "var(--color-text-3)" }}>
            Runs the real site in a sandboxed frame — if it stays blank, the site blocks embedding; use the tab link above
          </span>
        </button>
      )}
    </div>
  );
}
