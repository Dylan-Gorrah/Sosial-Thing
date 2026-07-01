"use server";

import { createClient } from "@/lib/supabase/server";

export async function markNotificationsRead(ids?: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  let q = supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (ids && ids.length > 0) q = (q as any).in("id", ids);

  const { error } = await q;
  return error ? { error: error.message } : { success: true };
}
