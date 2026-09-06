import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ThumbCarousel from "@/components/explore/ThumbCarousel";
import type { Metadata } from "next";

// ── Explore v3 — three-column, feed in the middle ────────────────────────────
// Reddit's real layout: the card feed front and center (the enticement), the
// community stuff in the rails. Left rail: trending tags + a join CTA. Right
// rail: live event, rooms to join, rising creators. Rails hide below lg so
// phones get the pure feed.
//
// Feed cards: content left, BIG thumbnail right (~40% of the card) — and when
// a post has multiple images the thumbnail is a mini carousel you can flip
// through without leaving the page (ThumbCarousel, a client island).
//
// Still public, cached, and niche-agnostic — nothing hardcodes a category.
// Design history in Brain → "Explore Page".

export const metadata: Metadata = {
  title: "Explore · SoDev",
  description: "The best work on SoDev right now — trending projects and posts from the community.",
};

export const revalidate = 300; // 5 min cache — trending doesn't need realtime

type FeedPost = {
  id: string;
  title: string;
  format: string;
  body_md: string | null;
  clout: number;
  comment_count: number;
  link_url: string | null;
  created_at: string;
  is_event: boolean;
  event_starts_at: string | null;
  author: { username: string | null; display_name: string | null } | null;
  post_images: { public_url: string; display_order: number }[] | null;
  showcase_meta: { repo_url: string | null; demo_url: string | null } | null;
};

type EventPost = {
  id: string;
  title: string;
  event_starts_at: string | null;
  post_images: { public_url: string; display_order: number }[] | null;
  room: { id: string; name: string } | null;
};

function fmtEventDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

// Local YouTube-id helper — VideoEmbed.tsx is a "use client" module, so its
// exports can't be imported into a server component like this page.
function getYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    if (host === "youtube.com" && u.pathname.startsWith("/shorts/"))
      return u.pathname.split("/shorts/")[1]?.split("?")[0] ?? null;
    if (host === "youtube.com") return u.searchParams.get("v");
    if (host === "youtu.be")    return u.pathname.slice(1).split("?")[0] || null;
  } catch { /* invalid URL */ }
  return null;
}

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 3600)   return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// All flippable visuals for a post: gallery images first, else the YouTube frame
function visualsFor(p: FeedPost): string[] {
  const imgs = (p.post_images ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map(i => i.public_url);
  if (imgs.length > 0) return imgs;
  const yt = p.link_url ? getYoutubeId(p.link_url) : null;
  return yt ? [`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`] : [];
}

// Plain-text snippet for cards without a visual
function snippet(md: string | null): string | null {
  if (!md) return null;
  const text = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*`>\[\]()_~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 180) : null;
}

function chipStyle(format: string): React.CSSProperties {
  switch (format) {
    case "showcase": return { background: "var(--color-accent-soft)", color: "var(--color-accent)" };
    case "link":     return { background: "rgba(56,139,253,.14)",     color: "#58a6ff" };
    case "media":    return { background: "rgba(255,86,48,.14)",      color: "var(--color-ember)" };
    default:         return { background: "rgba(255,255,255,.06)",    color: "var(--color-text-3)" };
  }
}

const AVATAR_COLORS = ["#ff2e7e", "#ff5630", "#2ea44f", "#388bfd", "#8b5cf6", "#f59e0b"];
function avatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function RailTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "0 0 10px", fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--color-text-3)", fontWeight: 600 }}>
      {children}
    </p>
  );
}

const RANGES = [
  { key: "day",  label: "Today",     days: 1 },
  { key: "week", label: "This week", days: 7 },
  { key: "all",  label: "All time",  days: null as number | null },
] as const;
type RangeKey = typeof RANGES[number]["key"];

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const range: RangeKey = (RANGES.some(r => r.key === t) ? t : "week") as RangeKey;
  const days = RANGES.find(r => r.key === range)!.days;

  const supabase = await createClient();

  const POST_SELECT = `
    id, title, format, body_md, clout, comment_count, link_url, created_at,
    is_event, event_starts_at,
    author:profiles(username, display_name),
    post_images(public_url, display_order),
    showcase_meta(repo_url, demo_url)
  `;

  let q = supabase.from("posts").select(POST_SELECT)
    .is("removed_at", null).neq("slop_status", "flagged");
  if (days !== null) {
    q = q.gte("created_at", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
  }

  const [postsRes, tagsRes, roomsRes, buildersRes, eventRes, { data: { user } }] = await Promise.all([
    q.order("clout", { ascending: false }).limit(25),
    supabase.from("tags").select("id, slug, name, post_count")
      .eq("status", "active").gt("post_count", 0)
      .order("post_count", { ascending: false }).limit(10),
    supabase.from("rooms").select("id, name, icon_url, member_count")
      .eq("type", "public").order("member_count", { ascending: false }).limit(5),
    supabase.rpc("get_leaderboard", { p_category: "clout", p_days: 7, p_room_id: null, p_limit: 5 }),
    supabase.from("rooms").select("id, name, description")
      .eq("type", "public").ilike("name", "%hackathon%").limit(1),
    supabase.auth.getUser(),
  ]);

  let posts = (postsRes.data ?? []) as unknown as FeedPost[];
  let quietFallback = false;

  // Quiet period — show newest instead of a blank page ("small but alive")
  if (posts.length === 0) {
    const { data } = await supabase.from("posts").select(POST_SELECT)
      .is("removed_at", null)
      .neq("slop_status", "flagged").order("created_at", { ascending: false }).limit(25);
    posts = (data ?? []) as unknown as FeedPost[];
    quietFallback = true;
  }

  const tags     = tagsRes.data ?? [];
  const rooms    = roomsRes.data ?? [];
  const builders = (buildersRes.data ?? []) as { rank: number; username: string; display_name: string | null; total: number }[];
  const event    = (eventRes.data ?? [])[0] ?? null;

  // ── Relevant events for the left rail ──────────────────────────────────────
  // Logged in: events from rooms you joined, people you follow, or your own.
  // Logged out: any upcoming public event (spectators should see what's on).
  // Empty when there's nothing — the section simply doesn't render.
  const EVENT_SELECT = `
    id, title, event_starts_at,
    post_images(public_url, display_order),
    room:rooms(id, name)
  `;
  const sinceYesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let upcomingEvents: EventPost[] = [];
  if (user) {
    const [memsRes, folsRes] = await Promise.all([
      supabase.from("room_members").select("room_id").eq("user_id", user.id),
      supabase.from("follows").select("following_id").eq("follower_id", user.id),
    ]);
    const roomIds = (memsRes.data ?? []).map(m => m.room_id);
    const folIds  = (folsRes.data ?? []).map(f => f.following_id);
    const orParts = [`user_id.eq.${user.id}`];
    if (folIds.length > 0)  orParts.push(`user_id.in.(${folIds.join(",")})`);
    if (roomIds.length > 0) orParts.push(`room_id.in.(${roomIds.join(",")})`);
    const { data } = await supabase.from("posts").select(EVENT_SELECT)
      .eq("is_event", true).is("removed_at", null).neq("slop_status", "flagged")
      .gte("event_starts_at", sinceYesterday)
      .or(orParts.join(","))
      .order("event_starts_at", { ascending: true }).limit(4);
    upcomingEvents = (data ?? []) as unknown as EventPost[];
  } else {
    const { data } = await supabase.from("posts").select(EVENT_SELECT)
      .eq("is_event", true).is("removed_at", null).neq("slop_status", "flagged")
      .gte("event_starts_at", sinceYesterday)
      .order("event_starts_at", { ascending: true }).limit(4);
    upcomingEvents = (data ?? []) as unknown as EventPost[];
  }

  return (
    <div className="h-full overflow-y-auto scroll" style={{ background: "var(--color-bg)" }}>
      <div
        className="lg:grid lg:gap-7"
        style={{ maxWidth: 1220, margin: "0 auto", padding: "30px 20px 90px", gridTemplateColumns: "190px minmax(0, 1fr) 280px" }}
      >

        {/* ══ LEFT RAIL — events, tags, join CTA (hidden below lg) ══ */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 flex flex-col gap-6">

            {/* Your events — rooms you joined, people you follow. Poster-first:
                a big image and a title; everything else lives on the post page. */}
            {upcomingEvents.length > 0 && (
              <div>
                <RailTitle>Events</RailTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {upcomingEvents.map(ev => {
                    const poster = (ev.post_images ?? [])
                      .slice().sort((a, b) => a.display_order - b.display_order)[0]?.public_url ?? null;
                    return (
                      <Link key={ev.id} href={`/post/${ev.id}`}
                        style={{ display: "block", textDecoration: "none", borderRadius: 12, overflow: "hidden", border: "1px solid var(--color-line)", background: "var(--color-panel)" }}
                      >
                        {poster ? (
                          <img src={poster} alt="" loading="lazy"
                            style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block", background: "#000" }} />
                        ) : (
                          <div style={{ width: "100%", aspectRatio: "4/3", display: "grid", placeItems: "center", background: `linear-gradient(150deg, ${avatarColor(ev.title)}26, var(--color-panel-2))` }}>
                            <span style={{ fontSize: 26 }}>📅</span>
                          </div>
                        )}
                        <div style={{ padding: "9px 11px 11px" }}>
                          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, lineHeight: 1.35, color: "var(--color-text)" }}>
                            {ev.title}
                          </p>
                          <p style={{ margin: "3px 0 0", fontSize: 10.5, color: "#3fb950", fontWeight: 600 }}>
                            {fmtEventDate(ev.event_starts_at)}
                          </p>
                          {ev.room && (
                            <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "var(--color-text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              in {ev.room.name}
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {tags.length > 0 && (
              <div>
                <RailTitle>Trending tags</RailTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {tags.map(tag => (
                    <Link key={tag.id} href={`/tags/${tag.slug}`}
                      style={{ textDecoration: "none", display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 10px", borderRadius: 7, fontSize: 12.5, color: "var(--color-text-2)", background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
                    >
                      <span>#{tag.name}</span>
                      <span style={{ fontSize: 10.5, color: "var(--color-text-3)" }}>{tag.post_count}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Join CTA — only for logged-out visitors; the feed is the pitch,
                this is the door */}
            {!user && (
              <div style={{ padding: "16px 14px", borderRadius: 12, background: "linear-gradient(160deg, var(--color-panel), var(--color-panel-2))", border: "1px solid var(--color-line)" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>Make things?</p>
                <p style={{ margin: "4px 0 12px", fontSize: 11.5, lineHeight: 1.5, color: "var(--color-text-3)" }}>
                  Post your work, get real feedback, build a rep that means something.
                </p>
                <Link href="/register"
                  style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "8px 0", borderRadius: 7, fontSize: 12.5, fontWeight: 600, color: "#fff", background: "var(--color-accent)" }}
                >
                  Join SoDev
                </Link>
              </div>
            )}
          </div>
        </aside>

        {/* ══ CENTER — the feed (the enticement) ══ */}
        <main style={{ minWidth: 0 }}>
          {/* Header + time toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 300, letterSpacing: "-.01em", color: "var(--color-text)" }}>
                Explore
              </h1>
              <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--color-text-3)" }}>
                {quietFallback ? "Fresh from the community" : "The best work right now"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 999, background: "var(--color-panel)", border: "1px solid var(--color-line)" }}>
              {RANGES.map(r => (
                <Link
                  key={r.key}
                  href={r.key === "week" ? "/explore" : `/explore?t=${r.key}`}
                  style={{
                    textDecoration: "none",
                    padding: "6px 13px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    background: range === r.key ? "var(--color-accent)" : "transparent",
                    color: range === r.key ? "#fff" : "var(--color-text-3)",
                  }}
                >
                  {r.label}
                </Link>
              ))}
            </div>
          </div>

          {/* The card feed — content left, big carousel thumbnail right */}
          {posts.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {posts.map(p => {
                const visuals = visualsFor(p);
                const text = visuals.length === 0 ? snippet(p.body_md) : null;
                const authorName = p.author?.display_name ?? p.author?.username ?? "unknown";
                return (
                  <Link
                    key={p.id}
                    href={`/post/${p.id}`}
                    className="block transition-colors"
                    style={{ textDecoration: "none", borderRadius: 14, border: "1px solid var(--color-line)", background: "var(--color-panel)", overflow: "hidden" }}
                  >
                    <div className="flex flex-col-reverse sm:flex-row" style={{ gap: 0 }}>
                      {/* Content — left */}
                      <div style={{ flex: 1, minWidth: 0, padding: "14px 16px 14px 18px", display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", padding: "3px 7px", borderRadius: 3, fontWeight: 600, ...chipStyle(p.format) }}>
                            {p.format}
                          </span>
                          {p.is_event && (
                            <span style={{ fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", padding: "3px 7px", borderRadius: 3, fontWeight: 600, background: "rgba(46,164,79,.16)", color: "#3fb950" }}>
                              Event{p.event_starts_at ? ` · ${new Date(p.event_starts_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}` : ""}
                            </span>
                          )}
                          <span style={{ fontSize: 11.5, color: "var(--color-text-3)" }}>
                            {authorName} · {timeAgo(p.created_at)}
                          </span>
                        </div>

                        <p style={{ margin: 0, fontSize: 16.5, fontWeight: 500, lineHeight: 1.32, color: "var(--color-text)" }}>
                          {p.title}
                        </p>

                        {text && (
                          <p style={{ margin: "7px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "var(--color-text-2)" }}>
                            {text}…
                          </p>
                        )}

                        <div style={{ display: "flex", alignItems: "center", gap: 13, marginTop: "auto", paddingTop: 12, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-accent)" }}>
                            ▲ {p.clout.toLocaleString()}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--color-text-3)" }}>
                            {p.comment_count.toLocaleString()} comment{p.comment_count === 1 ? "" : "s"}
                          </span>
                          {p.showcase_meta?.repo_url && (
                            <span style={{ fontSize: 11, color: "var(--color-text-3)", letterSpacing: ".04em" }}>⌁ repo</span>
                          )}
                          {p.showcase_meta?.demo_url && (
                            <span style={{ fontSize: 11, color: "var(--color-text-3)", letterSpacing: ".04em" }}>▶ demo</span>
                          )}
                        </div>
                      </div>

                      {/* Thumbnail — right, big (~40% of the card), carousel when
                          there's a gallery. Full-width on phones (stacks on top). */}
                      {visuals.length > 0 && (
                        <div className="w-full sm:w-[42%] sm:max-w-[300px] shrink-0" style={{ padding: 10 }}>
                          <div style={{ width: "100%", aspectRatio: "16/10" }}>
                            <ThumbCarousel images={visuals} />
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: "40px 20px", textAlign: "center", border: "1px dashed var(--color-line)", borderRadius: 14 }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-2)" }}>Nothing here yet.</p>
              <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--color-text-3)" }}>
                Be the first — post something you made.
              </p>
            </div>
          )}
        </main>

        {/* ══ RIGHT RAIL — event, rooms, creators (hidden below lg) ══ */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 flex flex-col gap-6">

            {/* Live event — top of the right rail, impossible to miss */}
            {event && (
              <Link
                href={`/rooms/${event.name}`}
                style={{ display: "block", textDecoration: "none", borderRadius: 12, padding: "14px 16px", background: "linear-gradient(135deg, rgba(255,46,126,.16), rgba(56,139,253,.10))", border: "1px solid var(--color-accent)" }}
              >
                <p style={{ margin: 0, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--color-accent)", fontWeight: 700 }}>
                  Live event
                </p>
                <p style={{ margin: "4px 0 2px", fontSize: 14.5, fontWeight: 600, color: "var(--color-text)" }}>{event.name}</p>
                {event.description && (
                  <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: "var(--color-text-2)" }}>{event.description}</p>
                )}
              </Link>
            )}

            {rooms.length > 0 && (
              <div>
                <RailTitle>Rooms to join</RailTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {rooms.map(r => (
                    <Link key={r.id} href={`/rooms/${r.name}`}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 10, border: "1px solid var(--color-line)", background: "var(--color-panel)", textDecoration: "none" }}
                    >
                      {r.icon_url ? (
                        <img src={r.icon_url} alt="" style={{ width: 28, height: 28, borderRadius: 7, objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, display: "grid", placeItems: "center", background: avatarColor(r.name), color: "#fff", fontWeight: 700, fontSize: 12 }}>
                          {r.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</p>
                        <p style={{ margin: "1px 0 0", fontSize: 10.5, color: "var(--color-text-3)" }}>
                          {r.member_count} member{r.member_count === 1 ? "" : "s"}
                        </p>
                      </div>
                    </Link>
                  ))}
                  <Link href="/rooms" style={{ fontSize: 11.5, color: "var(--color-text-3)", textDecoration: "none", padding: "2px 4px" }}>
                    All rooms →
                  </Link>
                </div>
              </div>
            )}

            {builders.length > 0 && (
              <div>
                <RailTitle>Rising creators</RailTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {builders.map(b => (
                    <Link key={b.username} href={`/u/${b.username}`}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderRadius: 10, border: "1px solid var(--color-line)", background: "var(--color-panel)", textDecoration: "none" }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, width: 14, textAlign: "center", color: b.rank === 1 ? "#f59e0b" : b.rank === 2 ? "#a8a9ad" : b.rank === 3 ? "#cd7f32" : "var(--color-text-3)" }}>
                        {b.rank}
                      </span>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", background: avatarColor(b.username ?? "?"), color: "#fff", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                        {(b.display_name ?? b.username ?? "?")[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {b.display_name ?? b.username}
                        </p>
                        <p style={{ margin: "1px 0 0", fontSize: 10.5, color: "var(--color-text-3)" }}>
                          +{b.total.toLocaleString()} clout this week
                        </p>
                      </div>
                    </Link>
                  ))}
                  <Link href="/leaderboard" style={{ fontSize: 11.5, color: "var(--color-text-3)", textDecoration: "none", padding: "2px 4px" }}>
                    Full leaderboard →
                  </Link>
                </div>
              </div>
            )}

          </div>
        </aside>

      </div>
    </div>
  );
}
