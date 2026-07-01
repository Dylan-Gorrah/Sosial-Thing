"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function revalidateTag(supabase: Awaited<ReturnType<typeof createClient>>, tagId: string) {
  const { data } = await supabase.from("tags").select("slug").eq("id", tagId).single();
  if (data?.slug) revalidatePath(`/tags/${data.slug}`);
}

export async function followTag(tagId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("tag_follows")
    .insert({ user_id: user.id, tag_id: tagId });

  if (error) return { error: error.message };
  await revalidateTag(supabase, tagId);
  return { success: true };
}

export async function unfollowTag(tagId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("tag_follows")
    .delete()
    .eq("user_id", user.id)
    .eq("tag_id", tagId);

  if (error) return { error: error.message };
  await revalidateTag(supabase, tagId);
  return { success: true };
}
