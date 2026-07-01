import { createClient } from "@/lib/supabase/server";
import RoomsClient from "@/components/rooms/RoomsClient";
import type { Room } from "@/types";

export default async function RoomsPage() {
  const supabase = await createClient();

  const [{ data: { user } }, { data: rooms }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("rooms")
      .select("*")
      .eq("type", "public")
      .order("member_count", { ascending: false }),
  ]);

  // Fetch the current user's memberships so cards show "Joined" correctly
  let memberRoomIds: string[] = [];
  if (user) {
    const { data: memberships } = await supabase
      .from("room_members")
      .select("room_id")
      .eq("user_id", user.id);
    memberRoomIds = (memberships ?? []).map(m => m.room_id);
  }

  return (
    <RoomsClient
      rooms={(rooms ?? []) as Room[]}
      memberRoomIds={memberRoomIds}
      currentUserId={user?.id ?? null}
    />
  );
}
