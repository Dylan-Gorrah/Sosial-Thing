"use client";

import { useState } from "react";

const SORTS = ["hot", "new", "top", "rising"] as const;

interface TopBarProps {
  onMenuClick: () => void;
  onNewPost?: () => void;
  title?: string;
  tabs?: { label: string; value: string }[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  sort?: string;
  onSortChange?: (sort: string) => void;
}

export default function TopBar({
  onMenuClick,
  onNewPost,
  title = "FRONT PAGE",
  tabs = [{ label: "Front Page", value: "front" }, { label: "Subscriptions", value: "subs" }],
  activeTab = "front",
  onTabChange,
  sort = "hot",
  onSortChange,
}: TopBarProps) {
  const [sortIdx, setSortIdx] = useState(SORTS.indexOf(sort as typeof SORTS[number]) ?? 0);

  function cycleSort() {
    const next = (sortIdx + 1) % SORTS.length;
    setSortIdx(next);
    onSortChange?.(SORTS[next]);
  }

  return (
    <header
      className="flex items-center gap-[18px] px-[14px] pl-[18px]"
      style={{
        borderBottom: "1px solid var(--color-line)",
        background: "var(--color-panel)",
        height: 52,
      }}
    >
      {/* hamburger — mobile only */}
      <button
        className="md:hidden grid place-items-center rounded-[7px] -ml-[6px] transition-all"
        style={{ width: 36, height: 36, color: "var(--color-text-2)" }}
        onClick={onMenuClick}
        title="Menu"
        onMouseEnter={e => {
          (e.currentTarget).style.background = "var(--color-panel-2)";
          (e.currentTarget).style.color = "var(--color-text)";
        }}
        onMouseLeave={e => {
          (e.currentTarget).style.background = "transparent";
          (e.currentTarget).style.color = "var(--color-text-2)";
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {/* page title */}
      <h1
        className="text-[13px] font-bold tracking-[.14em] whitespace-nowrap m-0"
        style={{ color: "var(--color-text)" }}
      >
        {title}
      </h1>

      {/* tabs — only when the page has them */}
      {tabs.length > 0 && (
        <div className="hidden md:flex gap-[18px]">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onTabChange?.(tab.value)}
              className="relative text-[11px] tracking-[.12em] uppercase py-[18px]"
              style={{ color: activeTab === tab.value ? "var(--color-text)" : "var(--color-text-3)" }}
            >
              {tab.label}
              {activeTab === tab.value && (
                <span className="absolute left-0 right-0 bottom-0 h-[2px]" style={{ background: "var(--color-accent)" }} />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1" />

      {/* icon buttons */}
      <button
        className="hidden md:grid place-items-center rounded-[7px] transition-all"
        style={{ width: 34, height: 34, color: "var(--color-text-3)" }}
        title="Refresh"
        onMouseEnter={e => {
          (e.currentTarget).style.color = "var(--color-text)";
          (e.currentTarget).style.background = "var(--color-panel-2)";
        }}
        onMouseLeave={e => {
          (e.currentTarget).style.color = "var(--color-text-3)";
          (e.currentTarget).style.background = "transparent";
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 11a8 8 0 1 0-1 5" /><path d="M20 5v6h-6" />
        </svg>
      </button>

      <button
        className="hidden md:grid place-items-center rounded-[7px] transition-all"
        style={{ width: 34, height: 34, color: "var(--color-text-3)" }}
        title="New Post"
        onClick={onNewPost}
        onMouseEnter={e => {
          (e.currentTarget).style.color = "var(--color-text)";
          (e.currentTarget).style.background = "var(--color-panel-2)";
        }}
        onMouseLeave={e => {
          (e.currentTarget).style.color = "var(--color-text-3)";
          (e.currentTarget).style.background = "transparent";
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" />
        </svg>
      </button>
    </header>
  );
}
