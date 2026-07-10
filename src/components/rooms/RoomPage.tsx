"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { joinRoom, leaveRoom, updateRoomIcon } from "@/app/actions/rooms";
import { votePost } from "@/app/actions/posts";
import PostCard from "@/components/feed/PostCard";
import PostDetail from "@/components/feed/PostDetail";
import TopContributors from "@/components/leaderboard/TopContributors";
import type { Post, Room } from "@/types";

// ── Icons ─────────────────────────────────────────────────────────────────────
const UsersIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><path d="M15 8a3 3 0 0 1 0 6"/><path d="M3 20c1-3.5 3.5-5 6-5"/><path d="M15 15c2.5 0 5 1.5 6 5"/></svg>;
const EmptyIcon  = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>;
const CameraIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
const SpinnerIcon = () => <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.22-8.56" strokeLinecap="round"/></svg>;
const InviteIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M16 11a4 4 0 1 0-4-4"/><path d="M3 21v-1a5 5 0 0 1 5-5h1"/><path d="M19 16v6M22 19h-6"/></svg>;
const ShieldIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10z"/></svg>;

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

interface Props {
  room: Room;
  isMember: boolean;
  isOwner: boolean;
  currentUserId: string | null;
}

export default function RoomPage({ room, isMember: initIsMember, isOwner, currentUserId }: Props) {
  const router  = useRouter();

  // Membership state — optimistic
  const [joined,      setJoined]      = useState(initIsMember);
  const [memberCount, setMemberCount] = useState(room.member_count);
  const [, startMemberTransition]     = useTransition();

  // Icon — owner/admin can click the avatar to replace it
  const [iconUrl,   setIconUrl]   = useState(room.icon_url);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleIconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || uploading) return;
    if (file.size > 5 * 1024 * 1024) return; // matches the room-icons bucket limit

    setUploading(true);
    const supabase = createClient();
    const ext  = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${room.id}/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabase.storage
      .from("room-icons")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (!error && data) {
      const { data: { publicUrl } } = supabase.storage.from("room-icons").getPublicUrl(data.path);
      setIconUrl(publicUrl);
      await updateRoomIcon(room.id, publicUrl);
    }
    setUploading(false);
  }

  // Invite link — private rooms are reachable only by code, so members can share
  const [inviteCopied, setInviteCopied] = useState(false);
  function handleCopyInvite() {
    if (!room.shareable_code) return;
    const link = `${window.location.origin}/rooms/join/${room.shareable_code}`;
    navigator.clipboard.writeText(link);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  }
  const canInvite = room.type === "private" && !!room.shareable_code && (isOwner || joined);

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
        .eq("user_id", currentUserId) // ratings are world-readable — only highlight the viewer's own votes
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
        <div className="flex items-center gap-4 px-6 py-4">
          {/* Room avatar — owner/admin can hover + click to change it */}
          <div className="relative flex-shrink-0" style={{ width: 44, height: 44 }}>
            <div
              className="grid place-items-center rounded-[9px] font-bold overflow-hidden"
              style={{ width: 44, height: 44, background: "var(--color-panel-2)", color: "var(--color-text-2)", fontSize: 18 }}
            >
              {iconUrl ? (
                <img src={iconUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                room.name[0].toUpperCase()
              )}
            </div>
            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Change room icon"
                  disabled={uploading}
                  className="absolute inset-0 grid place-items-center rounded-[9px] transition-opacity"
                  style={{ background: "rgba(0,0,0,.55)", color: "#fff", opacity: uploading ? 1 : 0, cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
                  onMouseLeave={e => { if (!uploading) (e.currentTarget as HTMLElement).style.opacity = "0"; }}
                >
                  {uploading ? <SpinnerIcon /> : <CameraIcon />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleIconChange} className="hidden" />
              </>
            )}
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

          {/* Mod queue — owners only; reports on this room's content land there */}
          {isOwner && (
            <a
              href="/mod"
              className="flex items-center gap-[6px] px-[13px] py-[7px] rounded-full text-[12px] font-semibold flex-shrink-0 transition-all"
              style={{ background: "transparent", color: "var(--color-text-2)", border: "1px solid var(--color-line)", textDecoration: "none" }}
              title="Review reports on this room's posts and comments"
            >
              <ShieldIcon />
              Mod queue
            </a>
          )}

          {/* Invite — private rooms only, for members who can share the link */}
          {canInvite && (
            <button
              onClick={handleCopyInvite}
              className="flex items-center gap-[6px] px-[13px] py-[7px] rounded-full text-[12px] font-semibold flex-shrink-0 transition-all"
              style={{
                background: "transparent",
                color: inviteCopied ? "var(--color-accent)" : "var(--color-text-2)",
                border: `1px solid ${inviteCopied ? "var(--color-accent)" : "var(--color-line)"}`,
              }}
              title="Copy an invite link for this private room"
            >
              <InviteIcon />
              {inviteCopied ? "Link copied" : "Invite"}
            </button>
          )}

          {/* Join / Leave — only shown to logged-in users */}
          {currentUserId && (
            <button
              onClick={handleJoinLeave}
              disabled={isOwner}
              className="px-5 py-[7px] rounded-full text-[12.5px] font-semibold flex-shrink-0 transition-all"
              style={
                joined
                  ? { background: "transparent", color: "var(--color-text-3)", border: "1px solid var(--color-line)", cursor: isOwner ? "default" : "pointer" }
                  : { background: "var(--color-accent)", color: "#fff", border: "1px solid var(--color-accent)" }
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

          {/* Who's carrying this room — clout earned from posts in here */}
          <TopContributors roomId={room.id} title="Top in this room · week" />

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
        <PostDetail
          post={activePost}
          currentUserId={currentUserId}
          userVote={activePost ? (userVotes[activePost.id] ?? null) : null}
          onVote={handleVoteOptimistic}
          onDeleted={(id) => {
            setPosts(prev => prev.filter(p => p.id !== id));
            setActiveId(cur => (cur === id ? null : cur));
          }}
        />
      </div>
    </div>
  );
}
