import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import RoomPage from "@/components/rooms/RoomPage";
import type { Room } from "@/types";

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase  = await createClient();

  const [{ data: { user } }, { data: room }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("rooms").select("*").eq("name", slug).single(),
  ]);

  if (!room) notFound();

  let isMember = false;
  let isOwner  = false;

  if (user) {
    const { data: membership } = await supabase
      .from("room_members")
      .select("role")
      .eq("room_id", room.id)
      .eq("user_id", user.id)
      .maybeSingle();

    isMember = !!membership;
    isOwner  = membership?.role === "owner";
  }

  return (
    <RoomPage
      room={room as Room}
      isMember={isMember}
      isOwner={isOwner}
      currentUserId={user?.id ?? null}
    />
  );
}
