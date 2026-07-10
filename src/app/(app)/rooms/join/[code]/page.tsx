import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

// Invite-link landing page. A private room can't be reached any other way —
// non-members can't even see it in a listing — so this route redeems the code,
// joins the caller via the join_room_by_code RPC, and drops them in the room.
export default async function JoinRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/rooms/join/${code}`)}`);

  const { data, error } = await supabase.rpc("join_room_by_code", { p_code: code });
  const message = error?.message ?? (data?.error as string | undefined);

  if (!message && data?.room_name) {
    redirect(`/rooms/${data.room_name}`);
  }

  return (
    <div className="h-full grid place-items-center px-6" style={{ background: "var(--color-bg)" }}>
      <div
        className="w-full max-w-[400px] text-center rounded-[12px] p-8"
        style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
      >
        <div
          className="mx-auto mb-4 grid place-items-center rounded-full"
          style={{ width: 44, height: 44, background: "rgba(255,86,48,.14)", color: "var(--color-ember)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
          </svg>
        </div>
        <h1 className="text-[16px] font-semibold m-0 mb-2" style={{ color: "var(--color-text)" }}>
          Couldn&apos;t join this room
        </h1>
        <p className="text-[13px] m-0 mb-6" style={{ color: "var(--color-text-3)" }}>
          {message ?? "That invite link is invalid or has expired."}
        </p>
        <Link
          href="/rooms"
          className="inline-block px-5 py-[9px] rounded-[6px] text-[13px] font-semibold text-white"
          style={{ background: "var(--color-accent)" }}
        >
          Browse rooms
        </Link>
      </div>
    </div>
  );
}
