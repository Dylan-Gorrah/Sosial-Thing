"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ── Icons ─────────────────────────────────────────────────────────────────────
const SearchIcon  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--color-text-3)" }}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>;
const CloseSmIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>;
const PostIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--color-text-3)" }}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>;
const PersonIcon  = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--color-text-3)", background: "var(--color-panel-2)", borderRadius: "50%", padding: 2 }}><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5"/></svg>;
const ArrowIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>;

// ── Types ─────────────────────────────────────────────────────────────────────
interface Results {
  posts: { id: string; title: string; clout: number; format: string }[];
  users: { id: string; username: string; display_name: string | null; avatar_url: string | null }[];
  tags:  { id: string; name: string; slug: string }[];
}

interface Props { open: boolean; onClose: () => void; }

export default function SearchModal({ open, onClose }: Props) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router   = useRouter();

  // Focus + reset on open
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults(null);
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [open]);

  // Keyboard: Escape closes, Enter goes to full results page
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Enter" && query.trim()) {
        onClose();
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, query, router]);

  // Debounced search — fires 260ms after typing stops
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults(null); return; }

    const t = setTimeout(async () => {
      setLoading(true);
      const sb  = createClient();
      const pat = `%${q}%`;
      const [{ data: posts }, { data: users }, { data: tags }] = await Promise.all([
        sb.from("posts")
          .select("id, title, clout, format")
          .or(`title.ilike.${pat},body_md.ilike.${pat}`)
          .limit(5),
        sb.from("profiles")
          .select("id, username, display_name, avatar_url")
          .or(`username.ilike.${pat},display_name.ilike.${pat}`)
          .limit(4),
        sb.from("tags")
          .select("id, name, slug")
          .ilike("name", pat)
          .eq("status", "active")
          .limit(6),
      ]);
      setResults({ posts: posts ?? [], users: users ?? [], tags: tags ?? [] });
      setLoading(false);
    }, 260);

    return () => clearTimeout(t);
  }, [query]);

  if (!open) return null;

  const trimmed   = query.trim();
  const hasAny    = results && (results.posts.length + results.users.length + results.tags.length) > 0;
  const showEmpty = trimmed && !loading && results && !hasAny;

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center" style={{ paddingTop: "11vh" }}>
      {/* scrim */}
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose} />

      {/* panel */}
      <div
        className="relative w-full mx-4 rounded-[12px] overflow-hidden"
        style={{
          maxWidth: 560,
          background: "var(--color-panel)",
          border: "1px solid var(--color-line)",
          boxShadow: "0 24px 64px rgba(0,0,0,.6)",
        }}
      >
        {/* Input row */}
        <div
          className="flex items-center gap-3 px-4"
          style={{ height: 52, borderBottom: trimmed ? "1px solid var(--color-line)" : "none" }}
        >
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search posts, people, tags…"
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: 14.5, color: "var(--color-text)" }}
          />
          {trimmed && (
            <button
              onClick={() => setQuery("")}
              style={{ color: "var(--color-text-3)", display: "flex", alignItems: "center" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"}
            >
              <CloseSmIcon />
            </button>
          )}
          <kbd style={{ fontSize: 10, color: "var(--color-text-3)", background: "var(--color-panel-2)", border: "1px solid var(--color-line)", borderRadius: 4, padding: "2px 6px", letterSpacing: ".05em", fontFamily: "inherit" }}>
            ESC
          </kbd>
        </div>

        {/* Results area */}
        {trimmed && (
          <div style={{ maxHeight: 440, overflowY: "auto" }}>

            {/* Hint while first load */}
            {loading && !results && (
              <div className="py-8 text-center text-[13px]" style={{ color: "var(--color-text-3)" }}>Searching…</div>
            )}

            {/* No results */}
            {showEmpty && (
              <div className="py-8 text-center text-[13px]" style={{ color: "var(--color-text-3)" }}>
                No results for &quot;{trimmed}&quot;
              </div>
            )}

            {/* Posts */}
            {(results?.posts.length ?? 0) > 0 && (
              <section>
                <p className="px-4 pt-3 pb-1 text-[10px] tracking-[.08em] uppercase" style={{ color: "var(--color-text-3)" }}>Posts</p>
                {results!.posts.map(p => (
                  <Link
                    key={p.id}
                    href={`/post/${p.id}`}
                    onClick={onClose}
                    className="flex items-center gap-3 px-4 py-[10px] transition-colors"
                    style={{ color: "var(--color-text)", textDecoration: "none" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--color-panel-2)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  >
                    <PostIcon />
                    <span className="flex-1 text-[13.5px] truncate">{p.title}</span>
                    <span className="text-[11px] tabular-nums font-semibold" style={{ color: "var(--color-accent)" }}>{p.clout.toLocaleString()}</span>
                  </Link>
                ))}
              </section>
            )}

            {/* People */}
            {(results?.users.length ?? 0) > 0 && (
              <section>
                <p className="px-4 pt-3 pb-1 text-[10px] tracking-[.08em] uppercase" style={{ color: "var(--color-text-3)" }}>People</p>
                {results!.users.map(u => (
                  <Link
                    key={u.id}
                    href={`/u/${u.username}`}
                    onClick={onClose}
                    className="flex items-center gap-3 px-4 py-[10px] transition-colors"
                    style={{ color: "var(--color-text)", textDecoration: "none" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--color-panel-2)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  >
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" className="rounded-full flex-shrink-0" style={{ width: 24, height: 24, objectFit: "cover" }} />
                      : <PersonIcon />
                    }
                    <span className="flex-1 text-[13.5px] truncate">{u.display_name ?? u.username}</span>
                    <span className="text-[11px]" style={{ color: "var(--color-text-3)" }}>@{u.username}</span>
                  </Link>
                ))}
              </section>
            )}

            {/* Tags */}
            {(results?.tags.length ?? 0) > 0 && (
              <section>
                <p className="px-4 pt-3 pb-1 text-[10px] tracking-[.08em] uppercase" style={{ color: "var(--color-text-3)" }}>Tags</p>
                <div className="flex flex-wrap gap-[7px] px-4 pb-4">
                  {results!.tags.map(t => (
                    <Link
                      key={t.id}
                      href={`/tags/${t.slug}`}
                      onClick={onClose}
                      className="px-3 py-1 rounded-full text-[12px] font-medium transition-all"
                      style={{ background: "var(--color-panel-2)", color: "var(--color-text-2)", border: "1px solid var(--color-line)", textDecoration: "none" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-accent)"; (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"; }}
                    >
                      #{t.name}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* View all footer */}
            {hasAny && (
              <Link
                href={`/search?q=${encodeURIComponent(trimmed)}`}
                onClick={onClose}
                className="flex items-center justify-center gap-2 py-[11px] text-[12.5px] font-medium transition-colors"
                style={{ borderTop: "1px solid var(--color-line)", color: "var(--color-text-3)", textDecoration: "none" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-panel-2)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
              >
                See all results for &quot;{trimmed}&quot; <ArrowIcon />
              </Link>
            )}
          </div>
        )}

        {/* Empty-state hint when nothing typed yet */}
        {!trimmed && (
          <div className="py-6 text-center text-[13px]" style={{ color: "var(--color-text-3)" }}>
            Type to search posts, people, and tags
            <div className="mt-2 text-[11px] tracking-[.06em] uppercase" style={{ opacity: 0.5 }}>Press Enter to see all results</div>
          </div>
        )}
      </div>
    </div>
  );
}
