import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TagPage from "@/components/tags/TagPage";
import type { Post } from "@/types";

export default async function TagRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase  = await createClient();

  const { data: tag } = await supabase
    .from("tags")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!tag) notFound();

  // Posts with this tag
  const { data: postTagRows } = await supabase
    .from("post_tags")
    .select("post_id")
    .eq("tag_id", tag.id);
  const postIds = (postTagRows ?? []).map((r: any) => r.post_id);

  let posts: Post[] = [];
  if (postIds.length > 0) {
    const { data } = await supabase
      .from("posts")
      .select(`
        *,
        author:profiles(id, username, display_name, avatar_url, clout_score, clout_tier),
        post_tags(tags(id, slug, name)),
        room:rooms(id, name),
        post_images(id, public_url, display_order, caption, width, height)
      `)
      .in("id", postIds)
      .is("removed_at", null)
      .order("clout", { ascending: false })
      .limit(40);

    posts = (data ?? []).map((p: any) => ({
      ...p,
      tags:   (p.post_tags ?? []).map((pt: any) => pt.tags).filter(Boolean),
      room:   p.room ?? null,
      images: (p.post_images ?? []).sort((a: any, b: any) => a.display_order - b.display_order),
    }));
  }

  const { data: { user } } = await supabase.auth.getUser();
  let isFollowing = false;
  if (user) {
    const { data } = await supabase
      .from("tag_follows")
      .select("tag_id")
      .eq("user_id", user.id)
      .eq("tag_id", tag.id)
      .maybeSingle();
    isFollowing = !!data;
  }

  return (
    <TagPage
      tag={tag}
      posts={posts}
      isFollowing={isFollowing}
      currentUserId={user?.id ?? null}
    />
  );
}
