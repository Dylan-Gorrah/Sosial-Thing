"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ReportReason = "spam" | "abuse" | "stolen_work" | "other";

// ── fileReport ────────────────────────────────────────────────────────────────
// Reports exactly one post or comment. Routing (room owner vs site admin),
// dedupe and the notification all happen inside the file_report RPC.
export async function fileReport(input: {
  postId?: string;
  commentId?: string;
  reason: ReportReason;
  note?: string;
}): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to report." };

  const { error } = await supabase.rpc("file_report", {
    p_post_id:    input.postId ?? null,
    p_comment_id: input.commentId ?? null,
    p_reason:     input.reason,
    p_note:       input.note?.trim() || null,
  });

  if (error) return { error: error.message };
  return { success: true };
}

// ── resolveReport ─────────────────────────────────────────────────────────────
export async function resolveReport(
  reportId: string,
  action: "resolved" | "dismissed",
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.rpc("resolve_report", {
    p_report_id: reportId,
    p_action:    action,
  });

  if (error) return { error: error.message };
  revalidatePath("/mod");
  return { success: true };
}

// ── Moderation actions — thin wrappers over the SECURITY DEFINER RPCs ────────
// Authorization lives in the DB functions (room owner or site admin only).

export async function removePostAction(
  postId: string,
  reason?: string,
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_post", {
    p_post_id: postId,
    p_reason:  reason?.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/mod");
  revalidatePath("/feed");
  return { success: true };
}

export async function blockMemberAction(
  roomId: string,
  userId: string,
  reason?: string,
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("block_member", {
    p_room_id: roomId,
    p_user_id: userId,
    p_reason:  reason?.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/mod");
  return { success: true };
}

export async function evictMemberAction(
  roomId: string,
  userId: string,
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("evict_member", {
    p_room_id: roomId,
    p_user_id: userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/mod");
  return { success: true };
}
