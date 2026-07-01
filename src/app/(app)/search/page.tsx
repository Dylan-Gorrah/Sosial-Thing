import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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

  const [{ data: posts }, { data: users }, { data: tags }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, title, clout, format, created_at, author:profiles(id, username, display_name)")
      .or(`title.ilike.${pat},body_md.ilike.${pat}`)
      .order("clout", { ascending: false })
      .limit(30),
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, clout_score, clout_tier")
      .or(`username.ilike.${pat},display_name.ilike.${pat}`)
      .limit(20),
    supabase
      .from("tags")
      .select("id, name, slug")
      .ilike("name", pat)
      .eq("status", "active")
      .limit(30),
  ]);

  const totalCount = (posts?.length ?? 0) + (users?.length ?? 0) + (tags?.length ?? 0);

  return (
    <div className="h-full overflow-y-auto">
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
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-text-3)", marginBottom: 12 }}>
              <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <p className="text-[14px] font-medium" style={{ color: "var(--color-text)" }}>No results found</p>
            <p className="text-[13px] mt-1" style={{ color: "var(--color-text-3)" }}>Try a different keyword</p>
          </div>
        )}

        {/* Posts */}
        {(posts?.length ?? 0) > 0 && (
          <section className="mb-8">
            <h2 className="text-[11px] tracking-[.08em] uppercase mb-3 font-semibold" style={{ color: "var(--color-text-3)" }}>
              Posts · {posts!.length}
            </h2>
            <div className="rounded-[10px] overflow-hidden" style={{ border: "1px solid var(--color-line)" }}>
              {posts!.map((p: any, i: number) => (
                <Link
                  key={p.id}
                  href={`/post/${p.id}`}
                  className="flex items-center gap-4 px-5 py-[13px] transition-colors"
                  style={{
                    borderTop: i > 0 ? "1px solid var(--color-line)" : "none",
                    background: "var(--color-panel)",
                    textDecoration: "none",
                    display: "flex",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--color-panel-2)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--color-panel)"}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] truncate" style={{ color: "var(--color-text)", fontWeight: 400 }}>{p.title}</p>
                    <p className="text-[11px] mt-[3px] tracking-[.04em]" style={{ color: "var(--color-text-3)" }}>
                      by {(p.author as any)?.username ?? "unknown"}
                    </p>
                  </div>
                  <span className="text-[12px] font-semibold tabular-nums flex-shrink-0" style={{ color: "var(--color-accent)" }}>
                    {p.clout.toLocaleString()}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* People */}
        {(users?.length ?? 0) > 0 && (
          <section className="mb-8">
            <h2 className="text-[11px] tracking-[.08em] uppercase mb-3 font-semibold" style={{ color: "var(--color-text-3)" }}>
              People · {users!.length}
            </h2>
            <div className="rounded-[10px] overflow-hidden" style={{ border: "1px solid var(--color-line)" }}>
              {users!.map((u: any, i: number) => (
                <Link
                  key={u.id}
                  href={`/u/${u.username}`}
                  className="flex items-center gap-4 px-5 py-[13px] transition-colors"
                  style={{
                    borderTop: i > 0 ? "1px solid var(--color-line)" : "none",
                    background: "var(--color-panel)",
                    textDecoration: "none",
                    display: "flex",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--color-panel-2)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--color-panel)"}
                >
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" className="rounded-full flex-shrink-0" style={{ width: 36, height: 36, objectFit: "cover" }} />
                    : (
                      <div className="rounded-full flex-shrink-0 flex items-center justify-center" style={{ width: 36, height: 36, background: "var(--color-panel-2)" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" style={{ color: "var(--color-text-3)" }}>
                          <circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5"/>
                        </svg>
                      </div>
                    )
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium truncate" style={{ color: "var(--color-text)" }}>{u.display_name ?? u.username}</p>
                    <p className="text-[11px] tracking-[.04em]" style={{ color: "var(--color-text-3)" }}>@{u.username}</p>
                  </div>
                  <span
                    className="text-[10px] tracking-[.07em] uppercase px-[8px] py-[3px] rounded-[4px] font-semibold flex-shrink-0"
                    style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
                  >
                    {u.clout_tier ?? "novice"}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Tags */}
        {(tags?.length ?? 0) > 0 && (
          <section>
            <h2 className="text-[11px] tracking-[.08em] uppercase mb-3 font-semibold" style={{ color: "var(--color-text-3)" }}>
              Tags · {tags!.length}
            </h2>
            <div className="flex flex-wrap gap-[8px]">
              {tags!.map((t: any) => (
                <Link
                  key={t.id}
                  href={`/tags/${t.slug}`}
                  className="px-4 py-[7px] rounded-full text-[13px] font-medium transition-all"
                  style={{ background: "var(--color-panel)", color: "var(--color-text-2)", border: "1px solid var(--color-line)", textDecoration: "none" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-accent)"; (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"; }}
                >
                  #{t.name}
                </Link>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
