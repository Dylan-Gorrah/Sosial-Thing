"use server";

import { createClient } from "@/lib/supabase/server";
import type { VerifyEvidence } from "@/types";

export async function voteComment(commentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vote_comment", { p_comment_id: commentId });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { success: true, liked: data.liked as boolean, like_count: data.like_count as number };
}

export async function verifyPost(postId: string, evidence: VerifyEvidence) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_post", {
    p_post_id: postId,
    p_evidence: evidence,
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { success: true, verified: data.verified as boolean, total_weight: data.total_weight as number };
}

export async function flagSlop(postId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("flag_slop", { p_post_id: postId });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { success: true, slop_confirmed: data.slop_confirmed as boolean };
}
