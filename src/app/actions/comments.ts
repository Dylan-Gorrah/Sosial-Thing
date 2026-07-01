"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addComment(_prev: unknown, formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to comment." };

  const post_id  = formData.get("post_id")  as string;
  const content  = (formData.get("content") as string).trim();
  const parent_id = (formData.get("parent_id") as string) || null;

  if (!content)          return { error: "Write something first." };
  if (content.length > 2000) return { error: "Max 2000 characters." };
  if (!post_id)          return { error: "Missing post." };

  const { error } = await supabase.from("comments").insert({
    post_id,
    user_id: user.id,
    content,
    parent_id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/post/${post_id}`);
  return { success: true };
}
