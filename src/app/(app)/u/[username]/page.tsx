import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProfileClient from "@/components/profile/ProfileClient";
import type { Post, Profile, UserBadge } from "@/types";

interface Props { params: Promise<{ username: string }> }

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  const [{ data: profile }, { data: { user } }] = await Promise.all([
    supabase.from("profiles").select("*").eq("username", username).single(),
    supabase.auth.getUser(),
  ]);

  if (!profile) notFound();

  const isOwn = user?.id === profile.id;

  // Fetch posts + follow state + badges (+ saved posts if own profile) in parallel
  const [{ data: postsRaw, count }, { data: followRow }, { data: badgesRaw }, { data: savedRaw }] = await Promise.all([
    supabase
      .from("posts")
      .select("*, post_tags(tags(id,slug,name)), showcase_meta(repo_url,demo_url), post_images(id,public_url,display_order,caption,width,height)", { count: "exact" })
      .eq("user_id", profile.id)
      .is("removed_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    user && !isOwn
      ? supabase
          .from("follows")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("user_badges")
      .select("*, badge:badges(*)")
      .eq("user_id", profile.id)
      .order("unlocked_at", { ascending: false }),
    isOwn
      ? supabase
          .from("bookmarks")
          .select("post:posts(*, author:profiles(id,username,display_name,avatar_url,clout_score,clout_tier), post_tags(tags(id,slug,name)), post_images(id,public_url,display_order,caption,width,height))")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: null }),
  ]);

  const posts: Post[] = (postsRaw ?? []).map((p: any) => ({
    ...p,
    author: profile as Profile,
    tags: (p.post_tags ?? []).map((pt: any) => pt.tags).filter(Boolean),
    showcase_meta: p.showcase_meta ?? null,
    images: (p.post_images ?? []).sort((a: any, b: any) => a.display_order - b.display_order),
  }));

  const savedPosts: Post[] = (savedRaw ?? [])
    .map((row: any) => row.post)
    .filter(Boolean)
    .map((p: any) => ({
      ...p,
      tags:   (p.post_tags ?? []).map((pt: any) => pt.tags).filter(Boolean),
      images: (p.post_images ?? []).sort((a: any, b: any) => a.display_order - b.display_order),
    }));

  return (
    <ProfileClient
      profile={profile as Profile}
      posts={posts}
      postCount={count ?? posts.length}
      badges={(badgesRaw ?? []) as UserBadge[]}
      savedPosts={savedPosts}
      isOwn={isOwn}
      isFollowing={!!followRow}
      currentUserId={user?.id ?? null}
    />
  );
}
