"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { markNotificationsRead } from "@/app/actions/notifications";

interface Notif {
  id: string;
  type: string;
  read: boolean;
  actor_id: string | null;
  post_id:  string | null;
  badge_id: string | null;
  created_at: string;
  actor:  { username: string; display_name: string | null } | null;
  post:   { id: string; title: string } | null;
  badge:  { id: string; name: string; tier: string } | null;
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const FollowIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><path d="M16 11l2 2 4-4"/></svg>;
const CommentIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M5 5h14v11H9l-4 3z"/></svg>;
const BadgeIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
const ShieldIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>;
const FlagIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21V4"/><path d="M4 4h12l-2 4 2 4H4"/></svg>;
const EmptyIcon   = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function badgeTierColor(tier: string): string {
  switch (tier) {
    case "legendary": return "#c084fc";
    case "platinum":  return "#94a3b8";
    case "gold":      return "var(--color-gold)";
    case "silver":    return "#a8a9ad";
    default:          return "#cd7f32"; // bronze
  }
}

function NotifIcon({ type, badgeTier }: { type: string; badgeTier?: string }) {
  if (type === "badge_unlocked") {
    const c = badgeTierColor(badgeTier ?? "bronze");
    return (
      <div className="flex items-center justify-center flex-shrink-0"
        style={{ width: 30, height: 30, borderRadius: "50%", background: `${c}22`, color: c }}>
        <BadgeIcon />
      </div>
    );
  }
  if (type === "post_verified") {
    return (
      <div className="flex items-center justify-center flex-shrink-0"
        style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(63,185,112,.13)", color: "#3fb970" }}>
        <ShieldIcon />
      </div>
    );
  }
  if (type === "post_slop_flagged" || type === "report_filed") {
    return (
      <div className="flex items-center justify-center flex-shrink-0"
        style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,86,48,.14)", color: "var(--color-ember)" }}>
        <FlagIcon />
      </div>
    );
  }
  const color = type === "new_follower" ? "var(--color-accent)" : "var(--color-blue)";
  return (
    <div className="flex items-center justify-center flex-shrink-0"
      style={{ width: 30, height: 30, borderRadius: "50%", background: type === "new_follower" ? "var(--color-accent-soft)" : "rgba(90,160,255,.14)", color }}>
      {type === "new_follower" ? <FollowIcon /> : <CommentIcon />}
    </div>
  );
}

function NotifRow({ notif }: { notif: Notif }) {
  const actor = notif.actor?.display_name ?? notif.actor?.username ?? "Someone";
  // Reports land in the mod queue, everything else goes to the post/profile
  const href  = notif.type === "report_filed" ? "/mod"
    : notif.post_id ? `/post/${notif.post_id}` : notif.actor ? `/u/${notif.actor.username}` : "#";

  let message: React.ReactNode;
  if (notif.type === "new_follower") {
    message = (
      <>
        <Link href={`/u/${notif.actor?.username ?? ""}`} className="font-semibold transition-colors" style={{ color: "var(--color-text)" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text)"}
        >
          {actor}
        </Link>
        <span style={{ color: "var(--color-text-2)" }}> started following you</span>
      </>
    );
  } else if (notif.type === "new_comment") {
    message = (
      <>
        <Link href={`/u/${notif.actor?.username ?? ""}`} className="font-semibold transition-colors" style={{ color: "var(--color-text)" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text)"}
        >
          {actor}
        </Link>
        <span style={{ color: "var(--color-text-2)" }}> commented on </span>
        {notif.post ? (
          <Link href={`/post/${notif.post.id}`} className="transition-colors" style={{ color: "var(--color-text-2)", textDecoration: "underline", textDecorationColor: "transparent" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"; (e.currentTarget as HTMLElement).style.textDecorationColor = "var(--color-accent)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"; (e.currentTarget as HTMLElement).style.textDecorationColor = "transparent"; }}
          >
            your post
          </Link>
        ) : (
          <span style={{ color: "var(--color-text-2)" }}>your post</span>
        )}
      </>
    );
  } else if (notif.type === "badge_unlocked") {
    message = (
      <>
        <span style={{ color: "var(--color-text-2)" }}>You earned the </span>
        <span className="font-semibold" style={{ color: "var(--color-text)" }}>{notif.badge?.name ?? "badge"}</span>
        <span style={{ color: "var(--color-text-2)" }}> badge</span>
      </>
    );
  } else if (notif.type === "post_verified") {
    message = (
      <>
        <span style={{ color: "var(--color-text-2)" }}>The community </span>
        <span className="font-semibold" style={{ color: "#3fb970" }}>verified</span>
        <span style={{ color: "var(--color-text-2)" }}> your post{notif.post ? ` "${notif.post.title}"` : ""} — +25 clout</span>
      </>
    );
  } else if (notif.type === "post_slop_flagged") {
    message = (
      <>
        <span style={{ color: "var(--color-text-2)" }}>Your post{notif.post ? ` "${notif.post.title}"` : ""} was flagged as low-effort by the community. It earns no clout until it gets verified.</span>
      </>
    );
  } else if (notif.type === "report_filed") {
    message = (
      <>
        <span style={{ color: "var(--color-text-2)" }}>Something you moderate was reported{notif.post ? ` — "${notif.post.title}"` : ""}. </span>
        <span className="font-semibold" style={{ color: "var(--color-ember)" }}>Review it</span>
      </>
    );
  } else {
    message = <span style={{ color: "var(--color-text-2)" }}>New notification</span>;
  }

  return (
    <Link
      href={href}
      className="flex items-start gap-3 px-4 py-[11px] transition-colors"
      style={{
        textDecoration: "none",
        background:     notif.read ? "transparent" : "rgba(255,46,126,.05)",
        borderBottom:   "1px solid var(--color-line)",
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = notif.read ? "rgba(255,255,255,.025)" : "rgba(255,46,126,.08)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = notif.read ? "transparent" : "rgba(255,46,126,.05)"}
    >
      <NotifIcon type={notif.type} badgeTier={notif.badge?.tier} />

      <div className="flex-1 min-w-0">
        <p className="m-0 leading-snug" style={{ fontSize: 12.5 }}>{message}</p>
        <span className="uppercase tracking-[.06em]" style={{ fontSize: 10, color: "var(--color-text-3)", marginTop: 3, display: "block" }}>
          {timeAgo(notif.created_at)}
        </span>
      </div>

      {!notif.read && (
        <span className="flex-shrink-0 mt-[6px]" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-accent)", display: "block", flexShrink: 0 }} />
      )}
    </Link>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
interface Props { railW: number; onClose: () => void; onMarkRead: () => void; }

export default function NotificationsPanel({ railW, onClose, onMarkRead }: Props) {
  const [notifs,  setNotifs]  = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [, startTransition]   = useTransition();

  useEffect(() => {
    const sb = createClient();
    sb.from("notifications")
      .select("*, actor:profiles!notifications_actor_id_fkey(username, display_name), post:posts!notifications_post_id_fkey(id, title), badge:badges!notifications_badge_id_fkey(id, name, tier)")
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        setNotifs((data ?? []) as Notif[]);
        setLoading(false);
      });

    // Mark all unread as read after a short delay
    const t = setTimeout(() => {
      startTransition(async () => {
        await markNotificationsRead();
        onMarkRead();
        setNotifs(prev => prev.map(n => ({ ...n, read: true })));
      });
    }, 800);

    return () => clearTimeout(t);
  }, [onMarkRead]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 bottom-0 z-[100] flex flex-col"
        style={{
          left:        railW,
          width:       300,
          background:  "var(--color-panel)",
          borderRight: "1px solid var(--color-line)",
          boxShadow:   "4px 0 24px rgba(0,0,0,.35)",
          animation:   "rise .16s ease both",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-[13px] flex-shrink-0"
          style={{ borderBottom: "1px solid var(--color-line)" }}
        >
          <span className="uppercase tracking-[.08em]" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--color-text-2)" }}>
            Notifications
          </span>
          <button
            onClick={onClose}
            style={{ fontSize: 10, color: "var(--color-text-3)", letterSpacing: ".05em", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"}
          >
            CLOSE
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto scroll">
          {loading && (
            <div className="flex flex-col gap-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-[11px]" style={{ borderBottom: "1px solid var(--color-line)" }}>
                  <div className="w-[30px] h-[30px] rounded-full animate-pulse flex-shrink-0" style={{ background: "var(--color-panel-2)" }} />
                  <div className="flex-1">
                    <div className="h-3 rounded mb-2 animate-pulse" style={{ background: "var(--color-panel-2)", width: "80%" }} />
                    <div className="h-2 rounded animate-pulse" style={{ background: "var(--color-panel-2)", width: "30%" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && notifs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16" style={{ color: "var(--color-text-3)" }}>
              <EmptyIcon />
              <p className="m-0 text-center" style={{ fontSize: 12.5 }}>No notifications yet.</p>
              <p className="m-0 text-center" style={{ fontSize: 11.5, color: "var(--color-text-3)", maxWidth: "22ch" }}>
                When someone follows you or comments on your post, it shows up here.
              </p>
            </div>
          )}

          {!loading && notifs.map(n => <NotifRow key={n.id} notif={n} />)}
        </div>
      </div>
    </>
  );
}
