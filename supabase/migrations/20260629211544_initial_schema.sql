-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS profiles (
    id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username            TEXT UNIQUE NOT NULL,
    email               TEXT NOT NULL,
    display_name        TEXT,
    bio                 TEXT,
    avatar_url          TEXT,
    location            TEXT,
    website             TEXT,
    github_url          TEXT,
    title               TEXT DEFAULT 'Code Newbie',
    tech_stack          TEXT[] DEFAULT ARRAY[]::TEXT[],
    clout_score         INTEGER DEFAULT 0,
    clout_tier          TEXT DEFAULT 'novice' CHECK (clout_tier IN ('novice','contributor','influencer','legend')),
    follower_count      INTEGER DEFAULT 0,
    following_count     INTEGER DEFAULT 0,
    streak              INTEGER DEFAULT 0,
    last_activity_date  DATE,
    availability_status TEXT DEFAULT 'available' CHECK (availability_status IN ('available','busy','away')),
    join_date           TIMESTAMPTZ DEFAULT NOW(),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type          TEXT NOT NULL CHECK (type IN ('project','idea')),
    title         TEXT NOT NULL,
    description   TEXT NOT NULL,
    github_url    TEXT,
    tags          TEXT[] DEFAULT ARRAY[]::TEXT[],
    room_id       UUID,
    clout         INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    view_count    INTEGER DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    parent_id  UUID REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_ratings (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating     INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS rooms (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name             TEXT NOT NULL,
    description      TEXT,
    type             TEXT NOT NULL DEFAULT 'public' CHECK (type IN ('public','private')),
    shareable_code   TEXT UNIQUE,
    created_by       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    member_count     INTEGER DEFAULT 0,
    allow_invites    BOOLEAN DEFAULT true,
    require_approval BOOLEAN DEFAULT false,
    enable_voting    BOOLEAN DEFAULT true,
    tags             TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_members (
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id   UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role      TEXT DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS badges (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    icon        TEXT NOT NULL,
    tier        TEXT NOT NULL CHECK (tier IN ('bronze','silver','gold','platinum','legendary')),
    requirement TEXT NOT NULL,
    rarity      TEXT DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary','secret')),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    badge_id    UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS clout_transactions (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action_type       TEXT NOT NULL,
    clout_amount      INTEGER NOT NULL,
    target_user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
    target_post_id    UUID REFERENCES posts(id) ON DELETE SET NULL,
    target_comment_id UUID REFERENCES comments(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_daily_activity (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    actions_count INTEGER DEFAULT 1,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, activity_date)
);

CREATE TABLE IF NOT EXISTS follows (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type       TEXT NOT NULL,
    read       BOOLEAN DEFAULT false,
    actor_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
    post_id    UUID REFERENCES posts(id) ON DELETE SET NULL,
    badge_id   UUID REFERENCES badges(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_posts (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_user_id       ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_type           ON posts(type);
CREATE INDEX IF NOT EXISTS idx_posts_created_at     ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_clout          ON posts(clout DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_id     ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id     ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_post_ratings_post_id ON post_ratings(post_id);
CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower     ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following    ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_posts_user     ON saved_posts(user_id);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_posts_updated_at    BEFORE UPDATE ON posts    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at    BEFORE UPDATE ON rooms    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_ratings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms              ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clout_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_posts        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all"  ON profiles FOR SELECT  USING (true);
CREATE POLICY "profiles_insert_own"  ON profiles FOR INSERT  WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"  ON profiles FOR UPDATE  USING (auth.uid() = id);

CREATE POLICY "posts_select_all"     ON posts FOR SELECT  USING (true);
CREATE POLICY "posts_insert_auth"    ON posts FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "posts_update_own"     ON posts FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "posts_delete_own"     ON posts FOR DELETE  USING (auth.uid() = user_id);

CREATE POLICY "comments_select_all"  ON comments FOR SELECT  USING (true);
CREATE POLICY "comments_insert_auth" ON comments FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "comments_update_own"  ON comments FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "comments_delete_own"  ON comments FOR DELETE  USING (auth.uid() = user_id);

CREATE POLICY "ratings_select_all"   ON post_ratings FOR SELECT  USING (true);
CREATE POLICY "ratings_insert_auth"  ON post_ratings FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "ratings_update_own"   ON post_ratings FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "ratings_delete_own"   ON post_ratings FOR DELETE  USING (auth.uid() = user_id);

CREATE POLICY "rooms_select_public"  ON rooms FOR SELECT  USING (type = 'public' OR created_by = auth.uid());
CREATE POLICY "rooms_insert_auth"    ON rooms FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "rooms_update_own"     ON rooms FOR UPDATE  USING (auth.uid() = created_by);
CREATE POLICY "rooms_delete_own"     ON rooms FOR DELETE  USING (auth.uid() = created_by);

CREATE POLICY "room_members_select"  ON room_members FOR SELECT
    USING (EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_members.room_id AND r.type = 'public')
        OR EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = room_members.room_id AND rm.user_id = auth.uid()));
CREATE POLICY "room_members_insert"  ON room_members FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "room_members_delete"  ON room_members FOR DELETE  USING (auth.uid() = user_id);

CREATE POLICY "badges_select_all"    ON badges FOR SELECT  USING (true);
CREATE POLICY "user_badges_select"   ON user_badges FOR SELECT  USING (true);
CREATE POLICY "user_badges_insert"   ON user_badges FOR INSERT  WITH CHECK (true);

CREATE POLICY "clout_select_own"     ON clout_transactions FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "clout_insert"         ON clout_transactions FOR INSERT  WITH CHECK (true);

CREATE POLICY "activity_select_own"  ON user_daily_activity FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "activity_all"         ON user_daily_activity FOR ALL     WITH CHECK (true);

CREATE POLICY "follows_select_all"   ON follows FOR SELECT  USING (true);
CREATE POLICY "follows_insert_auth"  ON follows FOR INSERT  WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_own"   ON follows FOR DELETE  USING (auth.uid() = follower_id);

CREATE POLICY "notifs_select_own"    ON notifications FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "notifs_insert"        ON notifications FOR INSERT  WITH CHECK (true);
CREATE POLICY "notifs_update_own"    ON notifications FOR UPDATE  USING (auth.uid() = user_id);

CREATE POLICY "saved_select_own"     ON saved_posts FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "saved_insert_auth"    ON saved_posts FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_delete_own"     ON saved_posts FOR DELETE  USING (auth.uid() = user_id);
