"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function revalidateProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("profiles").select("username").eq("id", userId).single();
  if (data?.username) revalidatePath(`/u/${data.username}`);
}

export async function followUser(userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (user.id === userId) return { error: "Cannot follow yourself" };

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, following_id: userId });

  if (error) return { error: error.message };
  await revalidateProfile(supabase, userId);
  return { success: true };
}

export async function unfollowUser(userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", userId);

  if (error) return { error: error.message };
  await revalidateProfile(supabase, userId);
  return { success: true };
}
