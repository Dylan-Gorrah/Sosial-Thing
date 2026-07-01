"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logout } from "@/app/actions/auth";
import NotificationsPanel from "./NotificationsPanel";

const W_COL = 60;
const W_EXP = 196;

// ── Icons ─────────────────────────────────────────────────────────────────────
const BellIcon    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const FlameIcon   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14c0-4 3.5-5 3.5-9 2 1.5 4 4.5 4 7.5a7 7 0 0 1-14 0c0-2 1-4 2.5-5.5-.5 2 1 4.5 4 7z"/></svg>;
const HomeIcon    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9h12v-9"/></svg>;
const RoomsIcon   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 9.5h16"/></svg>;
const ExploreIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="m15 9-2 5-4 1 2-5 4-1z" fill="currentColor" stroke="none"/></svg>;
const SearchIcon  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>;
const ComposeIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>;
const ProfileIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5"/></svg>;
const BackIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7"/></svg>;
const BurgerIcon  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>;
const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 160ms ease", flexShrink: 0 }}>
    <path d="M9 6l6 6-6 6"/>
  </svg>
);

const PROFILE_MENU = [
  { label: "Drafts",   href: "/drafts",   icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg> },
  { label: "Profile",  href: "/profile",  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5"/></svg> },
  { label: "Settings", href: "/settings", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="3"/><path d="M19.4 14a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V20a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 18.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 13a2 2 0 1 1 0-2 1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 4.6V4a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 17 5.7l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 19.4 11 2 2 0 1 1 19.4 14z"/></svg> },
];

interface RailProps { open: boolean; onClose: () => void; }

export default function Rail({ open, onClose }: RailProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const showBack = pathname !== "/feed";

  const [expanded,     setExpanded]     = useState(false);
  const [roomsOpen,    setRoomsOpen]    = useState(false);
  const [roomsVisible, setRoomsVisible] = useState(false);
  const [userRooms,    setUserRooms]    = useState<{ id: string; name: string }[]>([]);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [streak,       setStreak]       = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const profileRef = useRef<HTMLButtonElement>(null);
  const menuRef    = useRef<HTMLDivElement>(null);
  const prevExpandedRef = useRef(expanded);
  const [menuPos,   setMenuPos]   = useState({ bottom: 0, left: 68 });

  const onMarkRead = useCallback(() => setUnreadCount(0), []);

  // Fetch joined rooms + unread notification count, then subscribe to realtime
  useEffect(() => {
    const sb = createClient();
    let channel: ReturnType<typeof sb.channel> | null = null;

    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);

      // Rooms
      const { data: roomData } = await sb
        .from("room_members")
        .select("room:rooms(id, name)")
        .eq("user_id", user.id)
        .limit(20);
      if (roomData) setUserRooms((roomData as any[]).map(m => m.room).filter(Boolean));

      // Unread count + streak
      const [{ count }, { data: prof }] = await Promise.all([
        sb.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false),
        sb.from("profiles").select("streak").eq("id", user.id).single(),
      ]);
      setUnreadCount(count ?? 0);
      if (prof) setStreak((prof as any).streak ?? 0);

      // Realtime: increment badge on new notification
      channel = sb.channel(`notif-${user.id}`)
        .on("postgres_changes", {
          event:  "INSERT",
          schema: "public",
          table:  "notifications",
          filter: `user_id=eq.${user.id}`,
        }, () => {
          setUnreadCount(c => c + 1);
        })
        .subscribe();
    });

    return () => { if (channel) sb.removeChannel(channel); };
  }, []);

  // Close profile menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function h(e: MouseEvent) {
      if (
        menuRef.current    && !menuRef.current.contains(e.target as Node) &&
        profileRef.current && !profileRef.current.contains(e.target as Node)
      ) setMenuOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Rooms sub-list: if the rail was just re-expanded and rooms was previously
  // open, wait for the width transition to settle before revealing the list.
  // Toggling the chevron while already expanded still reveals instantly.
  useEffect(() => {
    const justExpanded = expanded && !prevExpandedRef.current;
    prevExpandedRef.current = expanded;

    if (!expanded) { setRoomsVisible(false); return; }

    if (justExpanded) {
      if (!roomsOpen) { setRoomsVisible(false); return; }
      const t = setTimeout(() => setRoomsVisible(true), 400);
      return () => clearTimeout(t);
    }

    setRoomsVisible(roomsOpen);
  }, [expanded, roomsOpen]);

  useEffect(() => {
    if (!menuOpen || !profileRef.current) return;
    const rect = profileRef.current.getBoundingClientRect();
    const railW = expanded ? W_EXP : W_COL;
    setMenuPos({ bottom: window.innerHeight - rect.bottom, left: railW + 8 });
  }, [menuOpen, expanded]);

  // ── Item style helpers ─────────────────────────────────────────────────────
  function itemBase(active: boolean, extra?: React.CSSProperties): React.CSSProperties {
    return {
      display:        "flex",
      alignItems:     "center",
      justifyContent: expanded ? "flex-start" : "center",
      gap:            expanded ? 10 : 0,
      height:         36,
      width:          expanded ? "100%" : 40,
      padding:        expanded ? "0 10px" : 0,
      borderRadius:   7,
      color:          active ? "var(--color-accent)" : "var(--color-text-3)",
      background:     active && expanded ? "var(--color-accent-soft)" : "transparent",
      transition:     "background 140ms, color 140ms",
      cursor:         "pointer",
      flexShrink:     0,
      position:       "relative",
      ...extra,
    };
  }

  function onHover(e: React.MouseEvent, active: boolean, on: boolean) {
    if (active) return;
    const el = e.currentTarget as HTMLElement;
    el.style.color      = on ? "var(--color-text)"  : "var(--color-text-3)";
    el.style.background = on ? "var(--color-panel)" : "transparent";
  }

  const label = (text: string) =>
    expanded ? <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", lineHeight: 1 }}>{text}</span> : null;

  const accentDot = (active: boolean) =>
    active && !expanded ? (
      <span className="absolute rounded-[3px]" style={{ left: -10, top: "50%", transform: "translateY(-50%)", width: 3, height: 18, background: "var(--color-accent)" }} />
    ) : null;

  const roomsActive = pathname.startsWith("/rooms");

  return (
    <nav
      className="flex flex-col py-3 gap-[2px] flex-shrink-0 overflow-hidden"
      style={{
        width:       expanded ? W_EXP : W_COL,
        transition:  "width 200ms ease",
        alignItems:  expanded ? "stretch" : "center",
        background:  "var(--color-rail)",
        borderRight: "1px solid var(--color-line)",
        zIndex:      70,
        padding:     expanded ? "12px 8px" : "12px 0",
      }}
    >
      {/* ── Hamburger ── */}
      <button
        title={expanded ? "Collapse menu" : "Expand menu"}
        onClick={() => setExpanded(e => !e)}
        style={itemBase(false)}
        onMouseEnter={e => onHover(e, false, true)}
        onMouseLeave={e => onHover(e, false, false)}
        className="mb-1"
      >
        <span className="flex-shrink-0"><BurgerIcon /></span>
        {label("Menu")}
      </button>

      {/* ── Back ── */}
      {showBack && (
        <button
          onClick={() => router.back()}
          title="Go back"
          style={itemBase(false)}
          onMouseEnter={e => onHover(e, false, true)}
          onMouseLeave={e => onHover(e, false, false)}
        >
          <span className="flex-shrink-0"><BackIcon /></span>
          {label("Back")}
        </button>
      )}

      {/* ── Home ── */}
      <Link
        href="/feed"
        title="Home"
        onClick={onClose}
        style={itemBase(pathname === "/feed")}
        onMouseEnter={e => onHover(e, pathname === "/feed", true)}
        onMouseLeave={e => onHover(e, pathname === "/feed", false)}
      >
        {accentDot(pathname === "/feed")}
        <span className="flex-shrink-0"><HomeIcon /></span>
        {label("Home")}
      </Link>

      {/* ── Rooms (expandable) ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Link
            href="/rooms"
            title="Rooms"
            onClick={onClose}
            style={{ ...itemBase(roomsActive), flex: expanded ? 1 : undefined }}
            onMouseEnter={e => onHover(e, roomsActive, true)}
            onMouseLeave={e => onHover(e, roomsActive, false)}
          >
            {accentDot(roomsActive)}
            <span className="flex-shrink-0"><RoomsIcon /></span>
            {label("Rooms")}
          </Link>

          {/* Disclosure chevron — only in expanded mode */}
          {expanded && (
            <button
              onClick={() => setRoomsOpen(o => !o)}
              title={roomsOpen ? "Collapse rooms" : "Expand rooms"}
              style={{
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                width:          26,
                height:         26,
                borderRadius:   5,
                color:          "var(--color-text-3)",
                flexShrink:     0,
                transition:     "background 140ms, color 140ms",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-panel)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
            >
              <ChevronIcon open={roomsOpen} />
            </button>
          )}
        </div>

        {/* Rooms sub-list */}
        {expanded && roomsVisible && (
          <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingLeft: 28, animation: "rise 160ms ease both" }}>
            {userRooms.length === 0 && (
              <span style={{ fontSize: 11.5, color: "var(--color-text-3)", padding: "4px 8px" }}>No rooms yet</span>
            )}
            {userRooms.map(room => {
              const rActive = pathname === `/rooms/${room.name}`;
              return (
                <Link
                  key={room.id}
                  href={`/rooms/${room.name}`}
                  style={{
                    display:     "block",
                    padding:     "5px 8px",
                    borderRadius: 5,
                    fontSize:    12.5,
                    fontWeight:  rActive ? 600 : 400,
                    color:       rActive ? "var(--color-accent)" : "var(--color-text-3)",
                    background:  rActive ? "var(--color-accent-soft)" : "transparent",
                    whiteSpace:  "nowrap",
                    overflow:    "hidden",
                    textOverflow:"ellipsis",
                    transition:  "background 120ms, color 120ms",
                  }}
                  onMouseEnter={e => { if (!rActive) { (e.currentTarget as HTMLElement).style.background = "var(--color-panel)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; } }}
                  onMouseLeave={e => { if (!rActive) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; } }}
                >
                  {room.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Explore ── */}
      <Link
        href="/explore"
        title="Explore"
        onClick={onClose}
        style={itemBase(pathname === "/explore")}
        onMouseEnter={e => onHover(e, pathname === "/explore", true)}
        onMouseLeave={e => onHover(e, pathname === "/explore", false)}
      >
        {accentDot(pathname === "/explore")}
        <span className="flex-shrink-0"><ExploreIcon /></span>
        {label("Explore")}
      </Link>

      {/* ── Search ── */}
      <button
        title="Search  (⌘K)"
        onClick={() => window.dispatchEvent(new Event("sodev:openSearch"))}
        style={itemBase(pathname.startsWith("/search"))}
        onMouseEnter={e => onHover(e, pathname.startsWith("/search"), true)}
        onMouseLeave={e => onHover(e, pathname.startsWith("/search"), false)}
      >
        {accentDot(pathname.startsWith("/search"))}
        <span className="flex-shrink-0"><SearchIcon /></span>
        {label("Search")}
      </button>

      <div style={{ flex: 1 }} />

      {/* ── Streak indicator ── */}
      {currentUserId && streak > 0 && (
        <div
          style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: expanded ? "flex-start" : "center",
            gap:            expanded ? 8 : 0,
            height:         32,
            width:          expanded ? "100%" : 40,
            padding:        expanded ? "0 10px" : 0,
            borderRadius:   7,
            color:          "#f97316",
            position:       "relative",
          }}
          title={`${streak}-day streak`}
        >
          <span className="flex-shrink-0" style={{ position: "relative" }}>
            <FlameIcon />
            {!expanded && (
              <span style={{ position: "absolute", top: -3, right: -4, minWidth: 13, height: 13, borderRadius: 7, background: "#f97316", color: "#fff", fontSize: 8.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: "0 2px" }}>
                {streak > 99 ? "99+" : streak}
              </span>
            )}
          </span>
          {expanded && <span style={{ fontSize: 12.5, fontWeight: 600, color: "#f97316", whiteSpace: "nowrap" }}>{streak}d streak</span>}
        </div>
      )}

      {/* ── Notifications ── */}
      {currentUserId && (
        <button
          title="Notifications"
          onClick={() => setNotifOpen(o => !o)}
          style={itemBase(notifOpen, { position: "relative" })}
          onMouseEnter={e => onHover(e, notifOpen, true)}
          onMouseLeave={e => onHover(e, notifOpen, false)}
        >
          <span className="flex-shrink-0" style={{ position: "relative" }}>
            <BellIcon />
            {unreadCount > 0 && (
              <span
                style={{
                  position:   "absolute",
                  top:        -4,
                  right:      -4,
                  minWidth:   14,
                  height:     14,
                  borderRadius: 7,
                  background: "var(--color-accent)",
                  color:      "#fff",
                  fontSize:   9,
                  fontWeight: 700,
                  display:    "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                  padding:    "0 3px",
                }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </span>
          {label("Notifications")}
        </button>
      )}

      {/* ── Compose ── */}
      <div style={{ height: 6 }} />
      <button
        title="New post"
        onClick={() => window.dispatchEvent(new Event("sodev:openCompose"))}
        style={itemBase(false)}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-accent)"; el.style.background = "var(--color-panel)"; }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-text-3)"; el.style.background = "transparent"; }}
      >
        <span className="flex-shrink-0"><ComposeIcon /></span>
        {label("New Post")}
      </button>

      {/* ── Profile button ── */}
      <div style={{ position: "relative" }}>
        <button
          ref={profileRef}
          title="Account"
          onClick={() => setMenuOpen(v => !v)}
          style={itemBase(menuOpen || pathname === "/profile", { background: menuOpen ? "var(--color-panel)" : undefined })}
          onMouseEnter={e => { if (!menuOpen && pathname !== "/profile") onHover(e, false, true); }}
          onMouseLeave={e => { if (!menuOpen && pathname !== "/profile") onHover(e, false, false); }}
        >
          <span className="flex-shrink-0"><ProfileIcon /></span>
          {label("Account")}
        </button>
      </div>

      {/* ── Notifications panel ── */}
      {notifOpen && (
        <NotificationsPanel
          railW={expanded ? W_EXP : W_COL}
          onClose={() => setNotifOpen(false)}
          onMarkRead={onMarkRead}
        />
      )}

      {/* ── Profile flyout ── */}
      {menuOpen && (
        <div
          ref={menuRef}
          style={{
            position:     "fixed",
            left:         menuPos.left,
            bottom:       menuPos.bottom,
            zIndex:       200,
            minWidth:     168,
            background:   "var(--color-panel)",
            border:       "1px solid var(--color-line)",
            borderRadius: 10,
            boxShadow:    "0 8px 32px rgba(0,0,0,.45)",
            padding:      "6px 0",
          }}
        >
          {PROFILE_MENU.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", color: pathname === item.href ? "var(--color-accent)" : "var(--color-text)", fontSize: 13, fontWeight: 500, textDecoration: "none", transition: "background 120ms" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-rail)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ color: pathname === item.href ? "var(--color-accent)" : "var(--color-text-3)", flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}

          <div style={{ margin: "6px 0", height: 1, background: "var(--color-line)" }} />

          <form action={logout}>
            <button
              type="submit"
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 14px", color: "var(--color-text)", fontSize: 13, fontWeight: 500, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", transition: "background 120ms, color 120ms" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-rail)"; (e.currentTarget as HTMLElement).style.color = "#ff4d4d"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; }}
            >
              <span style={{ color: "inherit", flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </span>
              Log out
            </button>
          </form>
        </div>
      )}
    </nav>
  );
}
