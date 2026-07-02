export type CloutTier        = "novice" | "contributor" | "influencer" | "legend";
export type AvailabilityStatus = "available" | "busy" | "away";
export type PostFormat       = "text" | "link" | "media" | "poll" | "showcase";
export type RoomType         = "public" | "private";
export type BadgeTier        = "bronze" | "silver" | "gold" | "platinum" | "legendary";
export type BadgeRarity      = "common" | "rare" | "epic" | "legendary" | "secret";
export type RoomRole         = "owner" | "admin" | "member";
export type TagStatus        = "active" | "deprecated" | "alias";

export interface Profile {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  website: string | null;
  github_url: string | null;
  title: string;
  tech_stack: string[];
  clout_score: number;
  clout_tier: CloutTier;
  follower_count: number;
  following_count: number;
  streak: number;
  last_activity_date: string | null;
  availability_status: AvailabilityStatus;
  join_date: string;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  follower_count: number;
  post_count: number;
  alias_of: string | null;
  status: TagStatus;
  created_at: string;
}

export interface ShowcaseMeta {
  post_id: string;
  repo_url: string | null;
  demo_url: string | null;
  links: Record<string, string>[];
}

export interface Post {
  id: string;
  user_id: string;
  format: PostFormat;
  title: string;
  body_md: string | null;
  link_url: string | null;
  room_id: string | null;
  is_nsfw: boolean;
  is_spoiler: boolean;
  is_oc: boolean;
  clout: number;
  comment_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  // joined
  author?: Profile;
  tags?: Tag[];
  showcase_meta?: ShowcaseMeta | null;
  room?: { id: string; name: string } | null;
  images?: PostImage[];
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  like_count: number;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  author?: Profile;
  replies?: Comment[];
}

export interface Room {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  type: RoomType;
  shareable_code: string | null;
  created_by: string;
  member_count: number;
  allow_invites: boolean;
  require_approval: boolean;
  enable_voting: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface PostImage {
  id: string;
  post_id: string;
  storage_path: string;
  public_url: string;
  display_order: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  created_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  requirement: string;
  rarity: BadgeRarity;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  unlocked_at: string;
  badge?: Badge;
}
