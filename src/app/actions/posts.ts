"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Hybrid tag governance (see Post System doc): anyone can coin a new tag, but
// it's normalized first so "3D Modeling" / "3d modeling" / "3d-modeling" all
// collapse to the same slug instead of fragmenting the tag pool.
function slugify(raw: string) {
  return raw.toLowerCase().trim().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export async function createPost(_prev: unknown, formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const format     = formData.get("format")     as string;
  const title      = (formData.get("title")      as string).trim();
  const body_md    = (formData.get("body_md")    as string | null)?.trim() || null;
  const link_url   = (formData.get("link_url")   as string | null)?.trim() || null;
  const repo_url   = (formData.get("repo_url")   as string | null)?.trim() || null;
  const demo_url   = (formData.get("demo_url")   as string | null)?.trim() || null;
  const tag_ids    = ((formData.get("tag_ids") as string) ?? "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const new_tag_names = ((formData.get("new_tags") as string) ?? "")
    .split(",").map(s => s.trim()).filter(Boolean).slice(0, 5);
  const is_nsfw    = formData.get("is_nsfw")    === "1";
  const is_spoiler = formData.get("is_spoiler") === "1";
  const is_oc      = formData.get("is_oc")      === "1";
  const room_id    = (formData.get("room_id")   as string | null) || null;
  const is_event   = formData.get("is_event")   === "1";
  const eventStartRaw = (formData.get("event_starts_at") as string | null)?.trim() || null;
  const event_starts_at = is_event && eventStartRaw ? new Date(eventStartRaw).toISOString() : null;

  const imagesRaw = (formData.get("images") as string | null)?.trim() || null;
  const imageList: { path: string; url: string }[] = imagesRaw ? JSON.parse(imagesRaw) : [];

  if (!title) return { error: "Title is required." };
  if (!["text", "link", "media", "poll", "showcase"].includes(format))
    return { error: "Pick a post format." };
  if (format === "link" && !link_url) return { error: "A URL is required for Link posts." };
  if (format === "media" && imageList.length === 0) return { error: "At least one image is required." };
  if (format === "text" && !body_md && !is_event) return { error: "Write something, or attach images or a link." };
  if (is_event && !event_starts_at) return { error: "An event needs a date and time." };
  if (is_event && new Date(event_starts_at!).getTime() < Date.now() - 60 * 60 * 1000)
    return { error: "That event date is in the past." };
  if (tag_ids.length + new_tag_names.length > 5) return { error: "Maximum 5 tags per post." };

  // New tags: normalize, then upsert so a concurrent duplicate just no-ops
  // instead of erroring — whoever gets there first "wins" the tag's name.
  let newTagIds: string[] = [];
  const slugs = [...new Set(new_tag_names.map(slugify).filter(Boolean))];
  if (slugs.length > 0) {
    const rows = slugs.map(slug => ({
      slug,
      name: new_tag_names.find(n => slugify(n) === slug) ?? slug,
    }));
    await supabase.from("tags").upsert(rows, { onConflict: "slug", ignoreDuplicates: true });
    const { data: resolved } = await supabase.from("tags").select("id").in("slug", slugs);
    newTagIds = (resolved ?? []).map(t => t.id);
  }

  // Insert the post row
  const { data: post, error: postErr } = await supabase
    .from("posts")
    .insert({ user_id: user.id, format, title, body_md, link_url, room_id, is_nsfw, is_spoiler, is_oc, is_event, event_starts_at })
    .select("id")
    .single();

  if (postErr || !post) return { error: postErr?.message ?? "Failed to create post." };

  // Attach tags (existing + newly created)
  const allTagIds = [...new Set([...tag_ids, ...newTagIds])].slice(0, 5);
  if (allTagIds.length > 0) {
    await supabase.from("post_tags").insert(
      allTagIds.map(tag_id => ({ post_id: post.id, tag_id }))
    );
  }

  // Showcase metadata — attached whenever repo/demo links exist. The composer
  // is content-first now: format is derived from what you attach, so a post
  // can carry links AND images at once (a hackathon entry in one post).
  if (repo_url || demo_url) {
    await supabase.from("showcase_meta").insert({ post_id: post.id, repo_url, demo_url });
  }

  // Image gallery — any format can carry images (post_images keys off post_id)
  if (imageList.length > 0) {
    await supabase.from("post_images").insert(
      imageList.map((img, i) => ({
        post_id:       post.id,
        storage_path:  img.path,
        public_url:    img.url,
        display_order: i,
      }))
    );
  }

  revalidatePath("/feed");
  return { success: true };
}

// ── votePost ──────────────────────────────────────────────────────────────────
// Called directly as a function (not via FormData) so UI components can call
// it from useTransition without needing a <form> wrapper.
// All the logic (toggle, switch, self-vote prevention) lives in the DB function.
export async function votePost(
  postId: string,
  direction: 1 | -1,
): Promise<{ error?: string; success?: boolean; delta?: number; direction?: number }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to vote." };

  const { data, error } = await supabase.rpc("vote_post", {
    p_post_id:   postId,
    p_direction: direction,
  });

  if (error)        return { error: error.message };
  if (data?.error)  return { error: data.error };

  revalidatePath(`/post/${postId}`);
  return { success: true, delta: data?.delta ?? 0, direction: data?.direction ?? direction };
}

// ── editPost ────────────────────────────────────────────────────────────────
// Owner-only, title + body only, allowed for 24h after posting. The window,
// ownership, and field scoping are all enforced inside the edit_post RPC.
export async function editPost(
  postId: string,
  fields: { title: string; body_md: string | null },
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data, error } = await supabase.rpc("edit_post", {
    p_post_id: postId,
    p_title:   fields.title,
    p_body_md: fields.body_md,
  });

  if (error)       return { error: error.message };
  if (data?.error) return { error: data.error };

  revalidatePath(`/post/${postId}`);
  revalidatePath("/feed");
  return { success: true };
}

// ── deletePost ──────────────────────────────────────────────────────────────
// No time limit. RLS (posts_delete_own) guarantees a user can only delete
// their own post; the extra user_id filter keeps it explicit.
export async function deletePost(postId: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/feed");
  return { success: true };
}

export async function toggleBookmark(postId: string): Promise<{ bookmarked?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to save posts." };

  const { data: existing } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .maybeSingle();

  if (existing) {
    await supabase.from("bookmarks").delete().eq("id", existing.id);
    return { bookmarked: false };
  } else {
    await supabase.from("bookmarks").insert({ user_id: user.id, post_id: postId });
    return { bookmarked: true };
  }
}
