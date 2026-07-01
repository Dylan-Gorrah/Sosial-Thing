"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { joinRoom } from "@/app/actions/rooms";
import CreateRoomModal from "./CreateRoomModal";
import type { Room } from "@/types";

// Consistent colour per room name first char — gives each room visual identity
const ROOM_COLORS = ["#ff2e7e","#ff5630","#2ea44f","#388bfd","#8b5cf6","#f59e0b","#06b6d4","#ec4899"];
function roomColor(name: string) {
  return ROOM_COLORS[name.charCodeAt(0) % ROOM_COLORS.length];
}

const PlusIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>;
const UsersIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><path d="M15 8a3 3 0 0 1 0 6"/><path d="M3 20c1-3.5 3.5-5 6-5"/><path d="M15 15c2.5 0 5 1.5 6 5"/></svg>;
const SearchIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>;

// ── Room card ─────────────────────────────────────────────────────────────────
function RoomCard({
  room,
  isMember,
  currentUserId,
}: {
  room: Room;
  isMember: boolean;
  currentUserId: string | null;
}) {
  const [joined,      setJoined]      = useState(isMember);
  const [memberCount, setMemberCount] = useState(room.member_count);
  const [, startTransition]           = useTransition();
  const color = roomColor(room.name);

  function handleJoin(e: React.MouseEvent) {
    e.preventDefault(); // don't follow the card link
    if (!currentUserId || joined) return;

    setJoined(true);
    setMemberCount(c => c + 1);

    startTransition(async () => {
      const result = await joinRoom(room.id);
      if (result.error) {
        setJoined(false);
        setMemberCount(c => c - 1);
      }
    });
  }

  return (
    <Link
      href={`/rooms/${room.name}`}
      className="group flex flex-col rounded-[10px] overflow-hidden transition-all duration-[140ms]"
      style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = color}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line)"}
    >
      {/* Colour bar — gives each room a visual identity without a banner image */}
      <div style={{ height: 5, background: color }} />

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Icon + name row */}
        <div className="flex items-center gap-3">
          <div className="grid place-items-center rounded-[8px] text-white font-bold flex-shrink-0" style={{ width: 38, height: 38, background: color, fontSize: 16 }}>
            {room.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold leading-tight truncate m-0" style={{ fontSize: 15, color: "var(--color-text)" }}>
              {room.name}
            </h3>
            <div className="flex items-center gap-[5px] text-[11.5px]" style={{ color: "var(--color-text-3)" }}>
              <UsersIcon />
              {memberCount.toLocaleString()} {memberCount === 1 ? "member" : "members"}
            </div>
          </div>
        </div>

        {/* Description */}
        {room.description && (
          <p className="text-[13px] leading-[1.5] m-0 line-clamp-2" style={{ color: "var(--color-text-2)" }}>
            {room.description}
          </p>
        )}

        {/* Footer: join button */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-[10.5px] tracking-[.06em] uppercase" style={{ color: "var(--color-text-3)" }}>
            {room.type}
          </span>
          {currentUserId && (
            <button
              onClick={handleJoin}
              className="px-4 py-[5px] rounded-full text-[11.5px] font-semibold transition-all"
              style={
                joined
                  ? { background: "transparent", color: "var(--color-text-3)", border: "1px solid var(--color-line)" }
                  : { background: color, color: "#fff", border: `1px solid ${color}` }
              }
            >
              {joined ? "Joined" : "Join"}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Rooms client ──────────────────────────────────────────────────────────────
interface Props {
  rooms: Room[];
  memberRoomIds: string[];
  currentUserId: string | null;
}

export default function RoomsClient({ rooms, memberRoomIds, currentUserId }: Props) {
  const [search,      setSearch]      = useState("");
  const [createOpen,  setCreateOpen]  = useState(false);
  const memberSet = new Set(memberRoomIds);

  const filtered = rooms.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const joined = filtered.filter(r => memberSet.has(r.id));
  const others = filtered.filter(r => !memberSet.has(r.id));

  return (
    <div className="h-full overflow-y-auto scroll" style={{ background: "var(--color-bg)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 24px 64px" }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-light tracking-[-.01em] m-0 mb-1" style={{ color: "var(--color-text)" }}>Rooms</h1>
            <p className="text-[13px] m-0" style={{ color: "var(--color-text-3)" }}>
              Developer communities for every topic
            </p>
          </div>
          {currentUserId && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 px-4 py-[9px] rounded-[7px] text-[13px] font-semibold text-white transition-all"
              style={{ background: "var(--color-accent)" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "0.85"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
            >
              <PlusIcon /> Create Room
            </button>
          )}
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 px-3 py-[10px] rounded-[8px] mb-8"
          style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
        >
          <span style={{ color: "var(--color-text-3)" }}><SearchIcon /></span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search rooms…"
            className="flex-1 bg-transparent text-[13.5px] outline-none"
            style={{ color: "var(--color-text)" }}
          />
        </div>

        {/* Joined rooms — shown first when the user has any */}
        {joined.length > 0 && (
          <div className="mb-10">
            <h2 className="text-[11px] tracking-[.12em] uppercase font-semibold mb-4" style={{ color: "var(--color-text-3)" }}>
              Your Rooms
            </h2>
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {joined.map(r => <RoomCard key={r.id} room={r} isMember currentUserId={currentUserId} />)}
            </div>
          </div>
        )}

        {/* All other rooms */}
        {others.length > 0 && (
          <div>
            {joined.length > 0 && (
              <h2 className="text-[11px] tracking-[.12em] uppercase font-semibold mb-4" style={{ color: "var(--color-text-3)" }}>
                Discover
              </h2>
            )}
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {others.map(r => <RoomCard key={r.id} room={r} isMember={false} currentUserId={currentUserId} />)}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-20" style={{ color: "var(--color-text-3)" }}>
            <p className="text-[14px]">No rooms found{search ? ` for "${search}"` : ""}.</p>
            {currentUserId && !search && (
              <button onClick={() => setCreateOpen(true)} className="mt-3 text-[13px] font-semibold" style={{ color: "var(--color-accent)" }}>
                Create the first one
              </button>
            )}
          </div>
        )}
      </div>

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
