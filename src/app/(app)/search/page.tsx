import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Server component — hover styling is CSS-only (no event handlers in RSC).

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const CheckIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 12 10 18 20 6" />
  </svg>
);
const PersonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" style={{ color: "var(--color-text-3)" }}>
    <circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" />
  </svg>
);
const RoomIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-text-3)" }}>
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const SearchIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-text-3)", marginBottom: 12 }}>
    <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
  </svg>
);

function formatChipStyle(format: string): React.CSSProperties {
  switch (format) {
    case "showcase": return { background: "var(--color-accent-soft)", color: "var(--color-accent)" };
    case "link":     return { background: "rgba(56,139,253,.14)",     color: "#58a6ff" };
    case "media":    return { background: "rgba(255,86,48,.14)",      color: "var(--color-ember)" };
    case "poll":     return { background: "rgba(163,113,247,.14)",    color: "#a371f7" };
    default:         return { background: "rgba(255,255,255,.06)",    color: "var(--color-text-3)" };
  }
}

const rowClass = "flex items-center gap-4 px-5 py-[13px] transition-colors bg-[var(--color-panel)] hover:bg-[var(--color-panel-2)]";

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] overflow-hidden divide-y divide-[var(--color-line)]" style={{ border: "1px solid var(--color-line)" }}>
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] tracking-[.08em] uppercase mb-3 font-semibold" style={{ color: "var(--color-text-3)" }}>
      {children}
    </h2>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query  = (q ?? "").trim();

  if (!query) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <p style={{ color: "var(--color-text-3)", fontSize: 14 }}>Enter a search term to get started.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const pat      = `%${query}%`;

  const [{ data: posts }, { data: users }, { data: rooms }, { data: tags }] = await Promise.all([
    supabase.rpc("search_posts", { p_query: query, p_limit: 30 }),
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, clout_score, clout_tier")
      .or(`username.ilike.${pat},display_name.ilike.${pat}`)
      .order("clout_score", { ascending: false })
      .limit(20),
    supabase
      .from("rooms")
      .select("id, name, description, type, member_count, icon_url")
      .or(`name.ilike.${pat},description.ilike.${pat}`)
      .order("member_count", { ascending: false })
      .limit(15),
    supabase
      .from("tags")
      .select("id, name, slug, post_count")
      .ilike("name", pat)
      .eq("status", "active")
      .limit(30),
  ]);

  const totalCount =
    (posts?.length ?? 0) + (users?.length ?? 0) + (rooms?.length ?? 0) + (tags?.length ?? 0);

  return (
    <div className="h-full overflow-y-auto scroll">
      <div className="max-w-[720px] mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[20px] font-semibold" style={{ color: "var(--color-text)" }}>
            Results for &quot;{query}&quot;
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--color-text-3)" }}>
            {totalCount === 0 ? "Nothing found" : `${totalCount} result${totalCount === 1 ? "" : "s"}`}
          </p>
        </div>

        {totalCount === 0 && (
          <div
            className="flex flex-col items-center py-16 rounded-[10px]"
            style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
          >
            <SearchIcon />
            <p className="text-[14px] font-medium" style={{ color: "var(--color-text)" }}>No results found</p>
            <p className="text-[13px] mt-1" style={{ color: "var(--color-text-3)" }}>Try a different keyword</p>
          </div>
        )}

        {/* Posts */}
        {(posts?.length ?? 0) > 0 && (
          <section className="mb-8">
            <SectionHeading>Posts · {posts!.length}</SectionHeading>
            <SectionCard>
              {posts!.map((p: any) => (
                <Link key={p.id} href={`/post/${p.id}`} className={rowClass} style={{ textDecoration: "none" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-[7px]">
                      <p className="text-[14px] truncate m-0" style={{ color: "var(--color-text)", fontWeight: 400 }}>{p.title}</p>
                      {p.verified && (
                        <span
                          className="inline-flex items-center gap-[3px] text-[8.5px] tracking-[.08em] uppercase px-[5px] py-[2px] rounded-[3px] flex-shrink-0"
                          style={{ background: "rgba(63,185,112,.13)", color: "#3fb970" }}
                        >
                          <CheckIcon /> Verified
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] mt-[3px] tracking-[.04em] m-0" style={{ color: "var(--color-text-3)" }}>
                      by {p.username ?? "unknown"} · {timeAgo(p.created_at)} · {p.comment_count} comment{p.comment_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span
                    className="text-[8.5px] tracking-[.08em] uppercase px-[6px] py-[2px] rounded-[3px] flex-shrink-0"
                    style={formatChipStyle(p.format)}
                  >
                    {p.format}
                  </span>
                  <span className="text-[12px] font-semibold tabular-nums flex-shrink-0" style={{ color: "var(--color-accent)" }}>
                    {p.clout.toLocaleString()}
                  </span>
                </Link>
              ))}
            </SectionCard>
          </section>
        )}

        {/* People */}
        {(users?.length ?? 0) > 0 && (
          <section className="mb-8">
            <SectionHeading>People · {users!.length}</SectionHeading>
            <SectionCard>
              {users!.map((u: any) => (
                <Link key={u.id} href={`/u/${u.username}`} className={rowClass} style={{ textDecoration: "none" }}>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" className="rounded-full flex-shrink-0" style={{ width: 36, height: 36, objectFit: "cover" }} />
                    : (
                      <div className="rounded-full flex-shrink-0 flex items-center justify-center" style={{ width: 36, height: 36, background: "var(--color-panel-2)" }}>
                        <PersonIcon />
                      </div>
                    )
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium truncate m-0" style={{ color: "var(--color-text)" }}>{u.display_name ?? u.username}</p>
                    <p className="text-[11px] tracking-[.04em] m-0" style={{ color: "var(--color-text-3)" }}>
                      @{u.username} · {u.clout_score.toLocaleString()} clout
                    </p>
                  </div>
                  <span
                    className="text-[10px] tracking-[.07em] uppercase px-[8px] py-[3px] rounded-[4px] font-semibold flex-shrink-0"
                    style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
                  >
                    {u.clout_tier ?? "novice"}
                  </span>
                </Link>
              ))}
            </SectionCard>
          </section>
        )}

        {/* Rooms */}
        {(rooms?.length ?? 0) > 0 && (
          <section className="mb-8">
            <SectionHeading>Rooms · {rooms!.length}</SectionHeading>
            <SectionCard>
              {rooms!.map((r: any) => (
                <Link key={r.id} href={`/rooms/${r.name}`} className={rowClass} style={{ textDecoration: "none" }}>
                  {r.icon_url
                    ? <img src={r.icon_url} alt="" className="rounded-[8px] flex-shrink-0" style={{ width: 36, height: 36, objectFit: "cover" }} />
                    : (
                      <div className="rounded-[8px] flex-shrink-0 flex items-center justify-center" style={{ width: 36, height: 36, background: "var(--color-panel-2)" }}>
                        <RoomIcon />
                      </div>
                    )
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium truncate m-0" style={{ color: "var(--color-text)" }}>{r.name}</p>
                    <p className="text-[11px] tracking-[.04em] truncate m-0" style={{ color: "var(--color-text-3)" }}>
                      {r.member_count} member{r.member_count === 1 ? "" : "s"}{r.description ? ` · ${r.description}` : ""}
                    </p>
                  </div>
                  {r.type === "private" && (
                    <span
                      className="text-[10px] tracking-[.07em] uppercase px-[8px] py-[3px] rounded-[4px] font-semibold flex-shrink-0"
                      style={{ background: "rgba(255,255,255,.06)", color: "var(--color-text-3)" }}
                    >
                      Private
                    </span>
                  )}
                </Link>
              ))}
            </SectionCard>
          </section>
        )}

        {/* Tags */}
        {(tags?.length ?? 0) > 0 && (
          <section>
            <SectionHeading>Tags · {tags!.length}</SectionHeading>
            <div className="flex flex-wrap gap-[8px]">
              {tags!.map((t: any) => (
                <Link
                  key={t.id}
                  href={`/tags/${t.slug}`}
                  className="px-4 py-[7px] rounded-full text-[13px] font-medium transition-all border border-[var(--color-line)] text-[var(--color-text-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                  style={{ background: "var(--color-panel)", textDecoration: "none" }}
                >
                  #{t.name}
                  {typeof t.post_count === "number" && t.post_count > 0 && (
                    <span className="ml-[6px] text-[11px]" style={{ color: "var(--color-text-3)" }}>{t.post_count}</span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
