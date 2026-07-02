"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createRoom(_prev: unknown, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to create a room." };

  // Normalise to lowercase slug — rooms are identified by name in URLs
  const raw  = (formData.get("name") as string ?? "").trim();
  const name = raw.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const description = (formData.get("description") as string ?? "").trim() || null;
  const type = (formData.get("type") as string) === "private" ? "private" : "public";

  if (!name || name.length < 2) return { error: "Room name must be at least 2 characters." };
  if (name.length > 30)         return { error: "Room name must be 30 characters or less." };

  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .insert({ name, description, type, created_by: user.id })
    .select("id, name")
    .single();

  if (roomErr) {
    if (roomErr.code === "23505") return { error: "A room called that already exists. Try a different name." };
    return { error: roomErr.message };
  }

  // Insert the creator as owner — must happen after the room exists
  await supabase.from("room_members").insert({
    room_id: room.id,
    user_id: user.id,
    role: "owner",
  });

  revalidatePath("/rooms");
  redirect(`/rooms/${room.name}`);
}

export async function updateRoomIcon(roomId: string, iconUrl: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // RLS (rooms_owner_update) already restricts this to the room's owner/admin
  const { error } = await supabase.from("rooms").update({ icon_url: iconUrl }).eq("id", roomId);
  if (error) return { error: error.message };

  revalidatePath("/rooms");
  return { success: true };
}

export async function joinRoom(roomId: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to join rooms." };

  // Idempotent — ignore if already a member
  const { error } = await supabase.from("room_members").insert({
    room_id: roomId,
    user_id: user.id,
    role:    "member",
  });

  if (error && error.code !== "23505") return { error: error.message };

  revalidatePath("/rooms");
  return { success: true };
}

export async function leaveRoom(roomId: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Owners can't leave — they need to transfer ownership first
  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single();

  if (membership?.role === "owner")
    return { error: "Owners can't leave. Transfer ownership first." };

  const { error } = await supabase
    .from("room_members")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/rooms");
  return { success: true };
}
