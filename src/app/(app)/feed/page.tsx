"use client";

import { useEffect, useState, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PostCard from "@/components/feed/PostCard";
import PostDetail from "@/components/feed/PostDetail";
import Sidebar from "@/components/layout/Sidebar";
import type { Post } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────
type FeedType = "home" | "following" | "rooms";
type Sort     = "hot"  | "new"       | "top"   | "rising";

// ── Icons ──────────────────────────────────────────────────────────────────────
const EmptyIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M9 9h6M9 12h6M9 15h4" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

// ── Feed tabs ─────────────────────────────────────────────────────────────────
const FEED_TABS: { value: FeedType; label: string; icon: ReactNode }[] = [
  {
    value: "home", label: "Home",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
      </svg>
    ),
  },
  {
    value: "following", label: "Following",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="9" cy="8" r="3"/>
        <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/>
        <path d="M17 11l2 2 4-4"/>
      </svg>
    ),
  },
  {
    value: "rooms", label: "Rooms",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
];

// ── Sort options ──────────────────────────────────────────────────────────────
const SORTS: { value: Sort; label: string; icon: ReactNode }[] = [
  {
    value: "hot", label: "Hot",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
        <path d="M12 2C9 7 7 10 7 14a5 5 0 0010 0c0-4-2-7-5-12z"/>
      </svg>
    ),
  },
  {
    value: "new", label: "New",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/>
      </svg>
    ),
  },
  {
    value: "top", label: "Top",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
        <rect x="3" y="13" width="4" height="8" rx="1"/>
        <rect x="10" y="8" width="4" height="13" rx="1"/>
        <rect x="17" y="3" width="4" height="18" rx="1"/>
      </svg>
    ),
  },
  {
    value: "rising", label: "Rising",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="3 17 9 11 13 15 21 7"/>
        <polyline points="15 7 21 7 21 13"/>
      </svg>
    ),
  },
];

export default function FeedPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const feed = (searchParams.get("feed") ?? "home") as FeedType;
  const sort = (searchParams.get("sort") ?? "hot")  as Sort;

  const [posts,         setPosts]         = useState<Post[]>([]);
  const [activeId,      setActiveId]      = useState<string | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null | undefined>(undefined);
  const [userVotes,     setUserVotes]     = useState<Record<string, "up" | "down">>({});
  const [userBookmarks, setUserBookmarks] = useState<Set<string>>(new Set());
  const [sortOpen,      setSortOpen]      = useState(false);
  const [feedOpen,      setFeedOpen]      = useState(false);
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
      if (feedRef.current && !feedRef.current.contains(e.target as Node)) setFeedOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Sidebar toggle
  useEffect(() => {
    const onToggle = () => setSidebarOpen(o => !o);
    window.addEventListener("sodev:toggleSidebar", onToggle);
    return () => window.removeEventListener("sodev:toggleSidebar", onToggle);
  }, []);

  // Resolve current user once on mount
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  // Load posts whenever feed type, sort, or user changes
  useEffect(() => {
    if (currentUserId === undefined) return; // still checking auth

    setLoading(true);
    const supabase = createClient();
    const now  = new Date();
    const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const day1 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();

    const POST_SELECT = `
      *,
      author:profiles(id, username, display_name, avatar_url, clout_score, clout_tier),
      post_tags(tags(id, slug, name)),
      showcase_meta(repo_url, demo_url),
      room:rooms(id, name),
      post_images(id, public_url, display_order, caption, width, height)
    `;

    function withSort(q: any) {
      if (sort === "hot")    return q.gte("created_at", day7).order("clout",      { ascending: false });
      if (sort === "new")    return q.order("created_at", { ascending: false });
      if (sort === "top")    return q.order("clout",      { ascending: false });
      if (sort === "rising") return q.gte("created_at", day1).order("clout",      { ascending: false });
      return q.order("created_at", { ascending: false });
    }

    function mapPosts(data: any[] | null): Post[] {
      return (data ?? []).map((p: any) => ({
        ...p,
        tags:          (p.post_tags ?? []).map((pt: any) => pt.tags).filter(Boolean),
        showcase_meta: p.showcase_meta ?? null,
        room:          p.room ?? null,
        images:        (p.post_images ?? []).sort((a: any, b: any) => a.display_order - b.display_order),
      }));
    }

    async function fetchVotes(loaded: Post[]) {
      if (loaded.length === 0 || !currentUserId) return;
      const ids = loaded.map(p => p.id);
      const [{ data: ratings }, { data: bmarks }] = await Promise.all([
        supabase.from("post_ratings").select("post_id, rating").in("post_id", ids),
        supabase.from("bookmarks").select("post_id").in("post_id", ids),
      ]);
      if (ratings) {
        const map: Record<string, "up" | "down"> = {};
        for (const r of ratings) map[r.post_id] = r.rating === 5 ? "up" : "down";
        setUserVotes(map);
      }
      if (bmarks) {
        setUserBookmarks(new Set(bmarks.map((b: any) => b.post_id)));
      }
    }

    function finish(loaded: Post[]) {
      setPosts(loaded);
      setActiveId(loaded[0]?.id ?? null);
      setLoading(false);
    }

    async function load() {
      // ── Following: posts from users I follow + posts with followed tags ──
      if (feed === "following") {
        if (!currentUserId) { finish([]); return; }

        const [followsRes, tagFollowsRes] = await Promise.all([
          supabase.from("follows").select("following_id").eq("follower_id", currentUserId),
          supabase.from("tag_follows").select("tag_id").eq("user_id", currentUserId),
        ]);

        const followedUserIds = (followsRes.data    ?? []).map((f: any) => f.following_id);
        const followedTagIds  = (tagFollowsRes.data ?? []).map((f: any) => f.tag_id);

        // Resolve tag follows → post IDs
        let tagPostIds: string[] = [];
        if (followedTagIds.length > 0) {
          const { data: tagPosts } = await supabase
            .from("post_tags")
            .select("post_id")
            .in("tag_id", followedTagIds);
          tagPostIds = (tagPosts ?? []).map((tp: any) => tp.post_id);
        }

        if (followedUserIds.length === 0 && tagPostIds.length === 0) { finish([]); return; }

        let q = supabase.from("posts").select(POST_SELECT);
        if (followedUserIds.length > 0 && tagPostIds.length > 0) {
          q = q.or(`user_id.in.(${followedUserIds.join(",")}),id.in.(${tagPostIds.join(",")})`);
        } else if (followedUserIds.length > 0) {
          q = q.in("user_id", followedUserIds);
        } else {
          q = q.in("id", tagPostIds);
        }

        const { data } = await withSort(q).limit(40);
        const loaded = mapPosts(data);
        finish(loaded);
        await fetchVotes(loaded);
        return;
      }

      // ── Rooms: posts from rooms I'm in ────────────────────────────────────
      if (feed === "rooms") {
        if (!currentUserId) { finish([]); return; }
        const { data: memberships } = await supabase
          .from("room_members").select("room_id").eq("user_id", currentUserId);
        const ids = (memberships ?? []).map((m: any) => m.room_id);
        if (!ids.length) { finish([]); return; }
        const { data } = await withSort(
          supabase.from("posts").select(POST_SELECT).in("room_id", ids)
        ).limit(40);
        const loaded = mapPosts(data);
        finish(loaded);
        await fetchVotes(loaded);
        return;
      }

      // ── Home: followed users + joined rooms, falls back to global new ─────
      if (!currentUserId) {
        // Shouldn't reach here (proxy guards /feed), but handle gracefully
        const { data } = await withSort(supabase.from("posts").select(POST_SELECT)).limit(40);
        const loaded = mapPosts(data);
        finish(loaded);
        await fetchVotes(loaded);
        return;
      }

      const [followsRes, membershipsRes] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", currentUserId),
        supabase.from("room_members").select("room_id").eq("user_id", currentUserId),
      ]);
      const followedIds = (followsRes.data ?? []).map((f: any) => f.following_id);
      const roomIds     = (membershipsRes.data ?? []).map((m: any) => m.room_id);

      let q = supabase.from("posts").select(POST_SELECT);

      if (followedIds.length === 0 && roomIds.length === 0) {
        // New user with no follows/rooms — show global feed so the page isn't empty
        q = q; // no filter
      } else if (followedIds.length > 0 && roomIds.length > 0) {
        q = q.or(`user_id.in.(${followedIds.join(",")}),room_id.in.(${roomIds.join(",")})`);
      } else if (followedIds.length > 0) {
        q = q.in("user_id", followedIds);
      } else {
        q = q.in("room_id", roomIds);
      }

      const { data } = await withSort(q).limit(40);
      const loaded = mapPosts(data);
      finish(loaded);
      await fetchVotes(loaded);
    }

    load();
  }, [feed, sort, currentUserId]);

  function navigate(params: Partial<{ feed: FeedType; sort: Sort }>) {
    const p = new URLSearchParams();
    p.set("feed", params.feed ?? feed);
    p.set("sort", params.sort ?? sort);
    router.push(`/feed?${p.toString()}`);
  }

  function handleVoteOptimistic(postId: string, delta: number, newDirection: "up" | "down" | null) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, clout: p.clout + delta } : p));
    setUserVotes(prev => {
      if (!newDirection) { const next = { ...prev }; delete next[postId]; return next; }
      return { ...prev, [postId]: newDirection };
    });
  }

  function handleBookmarkOptimistic(postId: string, saved: boolean) {
    setUserBookmarks(prev => {
      const next = new Set(prev);
      saved ? next.add(postId) : next.delete(postId);
      return next;
    });
  }

  const activePost  = posts.find(p => p.id === activeId) ?? null;
  const currentSort = SORTS.find(s => s.value === sort) ?? SORTS[0];

  const EMPTY_MSG: Record<FeedType, string[]> = {
    home:      ["Follow someone or join a room to personalise your feed."],
    following: ["You're not following anyone or any tags yet.", "Follow developers on their profiles, or explore tags to follow topics."],
    rooms:     ["You haven't joined any rooms yet.", "Browse rooms to get started."],
  };

  return (
    <div className="h-full flex min-h-0">

      {/* ── Post list ── */}
      <div className="scroll overflow-y-auto overflow-x-hidden flex-shrink-0" style={{ width: 360, borderRight: "1px solid var(--color-line)" }}>

        {/* Control bar */}
        <div
          className="flex items-center sticky top-0 z-10"
          style={{
            padding: "14px 16px",
            background: "var(--color-bg)",
            borderBottom: "1px solid var(--color-line)",
          }}
        >
          {/* Feed label — left, opens dropdown */}
          <div className="relative" ref={feedRef}>
            <button
              onClick={() => setFeedOpen(o => !o)}
              className="flex items-center gap-[5px] transition-colors"
              style={{ color: feedOpen ? "var(--color-text-2)" : "var(--color-text-3)" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"}
              onMouseLeave={e => { if (!feedOpen) (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
            >
              <span style={{ fontSize: 10, letterSpacing: ".08em" }}>
                {{ home: "FRONT PAGE", following: "FOLLOWING", rooms: "ROOMS" }[feed]}
              </span>
              <ChevronIcon />
            </button>

            {feedOpen && (
              <div
                className="absolute left-0 top-[calc(100%+8px)] rounded-[8px] overflow-hidden z-50"
                style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)", minWidth: 140, boxShadow: "0 8px 24px rgba(0,0,0,.2)" }}
              >
                {FEED_TABS.map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => { navigate({ feed: tab.value }); setFeedOpen(false); }}
                    className="flex items-center gap-[8px] w-full px-[13px] py-[9px] text-left transition-all"
                    style={feed === tab.value
                      ? { fontSize: 12.5, fontWeight: 600, color: "var(--color-accent)", background: "var(--color-accent-soft)" }
                      : { fontSize: 12.5, fontWeight: 500, color: "var(--color-text-2)" }}
                    onMouseEnter={e => { if (feed !== tab.value) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"; }}
                    onMouseLeave={e => { if (feed !== tab.value) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort — centered */}
          <div className="flex-1" />
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen(o => !o)}
              className="flex items-center gap-[4px] transition-colors"
              style={{ color: "var(--color-text-3)" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"}
              onMouseLeave={e => { if (!sortOpen) (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
            >
              <span style={{ fontSize: 10, letterSpacing: ".06em" }}>Sort: </span>
              <span style={{ fontSize: 10, letterSpacing: ".06em", color: "var(--color-accent)" }}>{sort}</span>
              <ChevronIcon />
            </button>

            {sortOpen && (
              <div
                className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+8px)] rounded-[8px] overflow-hidden z-50"
                style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)", minWidth: 130, boxShadow: "0 8px 24px rgba(0,0,0,.2)" }}
              >
                {SORTS.map(s => (
                  <button
                    key={s.value}
                    onClick={() => { navigate({ sort: s.value }); setSortOpen(false); }}
                    className="flex items-center gap-[8px] w-full px-[13px] py-[9px] text-left transition-all"
                    style={sort === s.value
                      ? { fontSize: 12.5, fontWeight: 600, color: "var(--color-accent)", background: "var(--color-accent-soft)" }
                      : { fontSize: 12.5, fontWeight: 500, color: "var(--color-text-2)" }}
                    onMouseEnter={e => { if (sort !== s.value) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"; }}
                    onMouseLeave={e => { if (sort !== s.value) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {s.icon}{s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1" />

          {/* Refresh — right */}
          <button
            onClick={() => navigate({ feed, sort })}
            title="Refresh"
            className="transition-colors"
            style={{ color: "var(--color-text-3)" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M8 16H3v5"/>
            </svg>
          </button>
        </div>

        {/* Skeleton loaders */}
        {loading && (
          <div className="flex flex-col gap-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-[18px] py-4" style={{ borderBottom: "1px solid var(--color-line)" }}>
                <div className="h-4 rounded mb-3 animate-pulse" style={{ background: "var(--color-panel)", width: "80%" }} />
                <div className="h-3 rounded mb-2 animate-pulse" style={{ background: "var(--color-panel)", width: "50%" }} />
                <div className="flex gap-2 mb-3">
                  <div className="h-[18px] w-16 rounded animate-pulse" style={{ background: "var(--color-panel)" }} />
                </div>
                <div className="h-3 rounded animate-pulse" style={{ background: "var(--color-panel)", width: "40%" }} />
              </div>
            ))}
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-2 px-6 text-center" style={{ color: "var(--color-text-3)" }}>
            <EmptyIcon />
            {EMPTY_MSG[feed].map((line, i) => (
              <p key={i} className="text-[13px] m-0">{line}</p>
            ))}
          </div>
        )}

        {!loading && posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            active={post.id === activeId}
            userVote={userVotes[post.id] ?? null}
            isBookmarked={userBookmarks.has(post.id)}
            onClick={() => setActiveId(post.id)}
            onVote={handleVoteOptimistic}
            onBookmark={handleBookmarkOptimistic}
          />
        ))}
      </div>

      {/* ── Sidebar toggle — fixed top-right, stays put regardless of sidebar state ── */}
      <button
        onClick={() => setSidebarOpen(o => !o)}
        title={sidebarOpen ? "Close panel" : "Open panel"}
        className="fixed z-20 flex items-center justify-center rounded-[6px] transition-colors duration-[140ms]"
        style={{
          top: 10, right: 10,
          width: 28, height: 28,
          color:      sidebarOpen ? "var(--color-text-2)" : "var(--color-text-3)",
          background: "var(--color-panel)",
          border:     "1px solid var(--color-line)",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--color-text-3)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = sidebarOpen ? "var(--color-text-2)" : "var(--color-text-3)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line)"; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M15 3v18" />
          </svg>
      </button>

      {/* ── Detail panel ── */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <PostDetail post={activePost} />
      </div>

      {/* ── Sidebar ── */}
      <Sidebar open={sidebarOpen} />
    </div>
  );
}
