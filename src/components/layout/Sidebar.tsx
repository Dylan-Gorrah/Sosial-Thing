"use client";

export default function Sidebar({ open }: { open: boolean }) {
  return (
    <div
      className="h-full flex-shrink-0 overflow-hidden"
      style={{
        width:      open ? 260 : 0,
        transition: "width 200ms ease",
      }}
    >
    <div
      className="h-full flex flex-col"
      style={{
        width: 260,
        background: "var(--color-rail)",
        borderLeft: "1px solid var(--color-line)",
      }}
    >
      {/* top spacing so content clears the fixed toggle button */}
      <div style={{ height: 48, flexShrink: 0 }} />

      {/* Compose */}
      <div className="p-4" style={{ borderBottom: "1px solid var(--color-line)" }}>
        <button
          onClick={() => window.dispatchEvent(new Event("sodev:openCompose"))}
          className="w-full py-[9px] rounded-[7px] text-[12.5px] font-semibold tracking-wide transition-opacity"
          style={{ background: "var(--color-accent)", color: "#fff" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        >
          + New Post
        </button>
      </div>

      {/* Trending tags slot */}
      <div className="p-4">
        <p
          className="uppercase tracking-[.08em] mb-3"
          style={{ fontSize: 10.5, color: "var(--color-text-3)" }}
        >
          Trending tags
        </p>
        <div className="flex flex-col gap-[2px]">
          {["rust", "typescript", "ai-ml", "webdev", "open-source"].map(tag => (
            <div
              key={tag}
              className="py-[6px] px-[8px] rounded-[5px] cursor-pointer transition-colors"
              style={{ fontSize: 12.5, color: "var(--color-text-2)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-panel)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"; }}
            >
              #{tag}
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}
