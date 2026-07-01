import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PostPage from "@/components/post/PostPage";
import type { Post, Comment } from "@/types";

export default async function PostPageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: postRaw }, { data: { user } }] = await Promise.all([
    supabase
      .from("posts")
      .select(`
        *,
        author:profiles(id, username, display_name, avatar_url, clout_score, clout_tier, title),
        post_tags(tags(id, slug, name)),
        showcase_meta(repo_url, demo_url),
        post_images(id, public_url, display_order, caption, width, height)
      `)
      .eq("id", id)
      .single(),
    supabase.auth.getUser(),
  ]);

  if (!postRaw) notFound();

  const post: Post = {
    ...postRaw,
    tags:         (postRaw.post_tags ?? []).map((pt: any) => pt.tags).filter(Boolean),
    showcase_meta: postRaw.showcase_meta ?? null,
    images:       (postRaw.post_images ?? []).sort((a: any, b: any) => a.display_order - b.display_order),
  };

  const [{ data: commentsRaw }, { data: ratingRow }] = await Promise.all([
    supabase
      .from("comments")
      .select(`*, author:profiles(id, username, display_name, avatar_url)`)
      .eq("post_id", id)
      .order("created_at", { ascending: true }),
    // Fetch the current user's vote state for this post so the vote buttons
    // start in the correct coloured state without a client-side round trip
    user
      ? supabase
          .from("post_ratings")
          .select("rating")
          .eq("post_id", id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const initialVote: "up" | "down" | null =
    ratingRow?.rating === 5 ? "up" : ratingRow?.rating === 1 ? "down" : null;

  return (
    <PostPage
      post={post}
      comments={(commentsRaw ?? []) as Comment[]}
      currentUserId={user?.id ?? null}
      initialVote={initialVote}
    />
  );
}
