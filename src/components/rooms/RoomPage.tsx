"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { joinRoom, leaveRoom } from "@/app/actions/rooms";
import { votePost } from "@/app/actions/posts";
import PostCard from "@/components/feed/PostCard";
import PostDetail from "@/components/feed/PostDetail";
import type { Post, Room } from "@/types";

// ── Icons ─────────────────────────────────────────────────────────────────────
const UsersIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><path d="M15 8a3 3 0 0 1 0 6"/><path d="M3 20c1-3.5 3.5-5 6-5"/><path d="M15 15c2.5 0 5 1.5 6 5"/></svg>;
const EmptyIcon  = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>;

type Sort = "hot" | "new" | "top" | "rising";
const SORTS: { value: Sort; label: string; icon: ReactNode }[] = [
  {
    value: "hot", label: "Hot",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
        <path d="M12 2C9 7 7 10 7 14a5 5 0 0010 0c0-4-2-7-5-12z"/>
      </svg>
    ),
  },
  {
    value: "new", label: "New",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/>
      </svg>
    ),
  },
  {
    value: "top", label: "Top",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
        <rect x="3" y="13" width="4" height="8" rx="1"/>
        <rect x="10" y="8" width="4" height="13" rx="1"/>
        <rect x="17" y="3" width="4" height="18" rx="1"/>
      </svg>
    ),
  },
  {
    value: "rising", label: "Rising",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="3 17 9 11 13 15 21 7"/>
        <polyline points="15 7 21 7 21 13"/>
      </svg>
    ),
  },
];

// Deterministic accent color per room name — same function as RoomsClient
const ROOM_COLORS = ["#ff2e7e","#ff5630","#2ea44f","#388bfd","#8b5cf6","#f59e0b","#06b6d4","#ec4899"];
function roomColor(name: string) {
  return ROOM_COLORS[name.charCodeAt(0) % ROOM_COLORS.length];
}

interface Props {
  room: Room;
  isMember: boolean;
  isOwner: boolean;
  currentUserId: string | null;
}

export default function RoomPage({ room, isMember: initIsMember, isOwner, currentUserId }: Props) {
  const router  = useRouter();
  const color   = roomColor(room.name);

  // Membership state — optimistic
  const [joined,      setJoined]      = useState(initIsMember);
  const [memberCount, setMemberCount] = useState(room.member_count);
  const [, startMemberTransition]     = useTransition();

  // Feed state
  const [sort,      setSort]      = useState<Sort>("hot");
  const [posts,     setPosts]     = useState<Post[]>([]);
  const [activeId,  setActiveId]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [userVotes, setUserVotes] = useState<Record<string, "up" | "down">>({});

  // Load posts whenever sort changes
  useEffect(() => {
    setLoading(true);

    const supabase = createClient();
    const now  = new Date();
    const day7 = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString();
    const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    let q = supabase
      .from("posts")
      .select(`
        *,
        author:profiles(id, username, display_name, avatar_url, clout_score, clout_tier),
        post_tags(tags(id, slug, name)),
        showcase_meta(repo_url, demo_url),
        room:rooms(id, name)
      `)
      .eq("room_id", room.id);

    if (sort === "hot")    q = q.gte("created_at", day7).order("clout",      { ascending: false });
    if (sort === "new")    q = q.order("created_at", { ascending: false });
    if (sort === "top")    q = q.order("clout",      { ascending: false });
    if (sort === "rising") q = q.gte("created_at", day1).order("clout",      { ascending: false });

    q.limit(40).then(async ({ data }) => {
      const loaded: Post[] = (data ?? []).map((p: any) => ({
        ...p,
        tags:          (p.post_tags ?? []).map((pt: any) => pt.tags).filter(Boolean),
        showcase_meta: p.showcase_meta ?? null,
        room:          p.room ?? null,
      }));

      setPosts(loaded);
      setActiveId(loaded[0]?.id ?? null);
      setLoading(false);

      if (loaded.length === 0 || !currentUserId) return;
      const { data: ratings } = await supabase
        .from("post_ratings")
        .select("post_id, rating")
        .in("post_id", loaded.map(p => p.id));

      if (ratings) {
        const map: Record<string, "up" | "down"> = {};
        for (const r of ratings) map[r.post_id] = r.rating === 5 ? "up" : "down";
        setUserVotes(map);
      }
    });
  }, [sort, room.id, currentUserId]);

  function handleVoteOptimistic(postId: string, delta: number, newDirection: "up" | "down" | null) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, clout: p.clout + delta } : p));
    setUserVotes(prev => {
      if (!newDirection) { const next = { ...prev }; delete next[postId]; return next; }
      return { ...prev, [postId]: newDirection };
    });
  }

  function handleJoinLeave() {
    if (!currentUserId) return;

    if (joined) {
      if (isOwner) return; // owners can't leave their own room
      setJoined(false);
      setMemberCount(c => c - 1);
      startMemberTransition(async () => {
        const r = await leaveRoom(room.id);
        if (r.error) { setJoined(true); setMemberCount(c => c + 1); }
        else router.refresh();
      });
    } else {
      setJoined(true);
      setMemberCount(c => c + 1);
      startMemberTransition(async () => {
        const r = await joinRoom(room.id);
        if (r.error) { setJoined(false); setMemberCount(c => c - 1); }
        else router.refresh();
      });
    }
  }

  const activePost = posts.find(p => p.id === activeId) ?? null;

  return (
    <div className="h-full flex flex-col min-h-0">

      {/* ── Room header ──────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid var(--color-line)", flexShrink: 0 }}>
        {/* Accent stripe — same as the card on the browse page so the room feels consistent */}
        <div style={{ height: 4, background: color }} />

        <div className="flex items-center gap-4 px-6 py-4">
          {/* Room avatar */}
          <div
            className="grid place-items-center rounded-[9px] text-white font-bold flex-shrink-0"
            style={{ width: 44, height: 44, background: color, fontSize: 18 }}
          >
            {room.name[0].toUpperCase()}
          </div>

          {/* Name + description */}
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-semibold m-0 leading-tight truncate" style={{ color: "var(--color-text)" }}>
              {room.name}
            </h1>
            {room.description && (
              <p className="text-[12.5px] m-0 mt-[2px] truncate" style={{ color: "var(--color-text-3)" }}>
                {room.description}
              </p>
            )}
          </div>

          {/* Member count */}
          <div className="flex items-center gap-[5px] flex-shrink-0" style={{ color: "var(--color-text-3)" }}>
            <UsersIcon />
            <span className="text-[12px] font-medium">{memberCount.toLocaleString()}</span>
          </div>

          {/* Join / Leave — only shown to logged-in users */}
          {currentUserId && (
            <button
              onClick={handleJoinLeave}
              disabled={isOwner}
              className="px-5 py-[7px] rounded-full text-[12.5px] font-semibold flex-shrink-0 transition-all"
              style={
                joined
                  ? { background: "transparent", color: "var(--color-text-3)", border: "1px solid var(--color-line)", cursor: isOwner ? "default" : "pointer" }
                  : { background: color, color: "#fff", border: `1px solid ${color}` }
              }
              title={isOwner ? "You own this room" : undefined}
            >
              {isOwner ? "Owner" : joined ? "Joined" : "Join"}
            </button>
          )}
        </div>
      </div>

      {/* ── Post list + detail (same two-column layout as feed) ────────────── */}
      <div className="flex-1 grid min-h-0" style={{ gridTemplateColumns: "404px 1fr" }}>

        {/* Left: sort tabs + card list */}
        <div className="scroll overflow-y-auto" style={{ borderRight: "1px solid var(--color-line)" }}>
          <div
            className="flex items-center gap-2 px-3 py-[10px] sticky top-0 z-10"
            style={{ background: "var(--color-bg)", borderBottom: "1px solid var(--color-line)" }}
          >
            {SORTS.map(s => (
              <button
                key={s.value}
                onClick={() => setSort(s.value)}
                className="flex items-center gap-[6px] px-[12px] py-[7px] rounded-full text-[12.5px] font-semibold whitespace-nowrap flex-shrink-0 transition-all"
                style={
                  sort === s.value
                    ? { background: "var(--color-accent-soft)", color: "var(--color-accent)" }
                    : { background: "var(--color-panel)", color: "var(--color-text-3)" }
                }
                onMouseEnter={e => { if (sort !== s.value) (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"; }}
                onMouseLeave={e => { if (sort !== s.value) (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex flex-col gap-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-[18px] py-4" style={{ borderBottom: "1px solid var(--color-line)" }}>
                  <div className="h-4 rounded mb-3 animate-pulse" style={{ background: "var(--color-panel)", width: "75%" }} />
                  <div className="h-3 rounded mb-2 animate-pulse" style={{ background: "var(--color-panel)", width: "45%" }} />
                </div>
              ))}
            </div>
          )}

          {!loading && posts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-3" style={{ color: "var(--color-text-3)" }}>
              <EmptyIcon />
              <p className="text-[13px]">No posts yet in this room.</p>
            </div>
          )}

          {!loading && posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              active={post.id === activeId}
              userVote={userVotes[post.id] ?? null}
              onClick={() => setActiveId(post.id)}
              onVote={handleVoteOptimistic}
            />
          ))}
        </div>

        {/* Right: detail panel */}
        <PostDetail post={activePost} />
      </div>
    </div>
  );
}
