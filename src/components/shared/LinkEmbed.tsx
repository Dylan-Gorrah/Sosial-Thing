"use client";

import { useState } from "react";

const ExternalIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 4 5.7 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.7-4-9s1.5-6.5 4-9z" />
  </svg>
);

function hostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

// Loads an external link inline, but only once clicked — like the video facade,
// nothing heavy loads just from opening the post. Note: sites that send
// X-Frame-Options / CSP frame-ancestors headers (GitHub, X, most modern SaaS)
// will refuse to render here — the browser blocks it silently, there's no
// reliable way to detect that from JS. The floating "open externally" button
// is the escape hatch, and it's available whether or not the embed is loaded.
export function LinkEmbed({ url }: { url: string }) {
  const [active, setActive] = useState(false);

  return (
    <div style={{ position: "relative", width: "100%", height: 560, background: "#0a0a0e" }}>
      {active ? (
        <iframe
          src={url}
          className="absolute inset-0 w-full h-full"
          style={{ border: "none" }}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
          title="Embedded site"
        />
      ) : (
        <button
          onClick={() => setActive(true)}
          className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-3 border-none cursor-pointer"
          style={{ background: "#0a0a0e", color: "var(--color-text-3)" }}
        >
          <div className="grid place-items-center rounded-full" style={{ width: 52, height: 52, background: "var(--color-panel-2)", color: "var(--color-text-2)" }}>
            <GlobeIcon />
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-text)" }}>{hostname(url)}</div>
          <div style={{ fontSize: 11.5, letterSpacing: ".03em" }}>Click to load the embedded site</div>
        </button>
      )}

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in a new tab"
        className="absolute flex items-center justify-center rounded-full transition-all"
        style={{
          top: 10,
          right: 10,
          width: 30,
          height: 30,
          background: "rgba(20,20,23,.8)",
          border: "1px solid var(--color-line)",
          color: "var(--color-text-2)",
          backdropFilter: "blur(4px)",
        }}
        onClick={e => e.stopPropagation()}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--color-text-3)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line)"; }}
      >
        <ExternalIcon />
      </a>
    </div>
  );
}
