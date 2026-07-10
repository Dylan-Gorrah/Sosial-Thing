import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PostPage from "@/components/post/PostPage";
import type { Post, Comment } from "@/types";
import type { Metadata } from "next";

// ── OG / Twitter cards ────────────────────────────────────────────────────────
// The invisible half of sharing: a SoDev link pasted into WhatsApp, Discord or
// X should unfurl with the post title, author and first image — not a blank
// grey box. This is what makes shared hackathon entries actually get clicked.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("title, body_md, format, author:profiles(username, display_name), post_images(public_url, display_order)")
    .eq("id", id)
    .single();

  if (!post) return { title: "Post not found · SoDev" };

  const authorRaw = post.author as { username?: string; display_name?: string } | null;
  const author = authorRaw?.display_name ?? authorRaw?.username ?? "a SoDev builder";

  // Strip markdown syntax down to plain text for the description snippet
  const description =
    (post.body_md ?? "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[#*`>\[\]()_~]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160) || `A ${post.format} post by ${author} on SoDev — where your code speaks.`;

  const firstImage = ((post.post_images as { public_url: string; display_order: number }[]) ?? [])
    .sort((a, b) => a.display_order - b.display_order)[0]?.public_url;

  return {
    title: `${post.title} · SoDev`,
    description,
    openGraph: {
      title: post.title,
      description,
      type: "article",
      siteName: "SoDev",
      ...(firstImage ? { images: [{ url: firstImage }] } : {}),
    },
    twitter: {
      card: firstImage ? "summary_large_image" : "summary",
      title: post.title,
      description,
      ...(firstImage ? { images: [firstImage] } : {}),
    },
  };
}

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
