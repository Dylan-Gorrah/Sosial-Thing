
-- ─────────────────────────────────────────────
-- Migration 002 — Align posts with Post System design
-- ─────────────────────────────────────────────

-- 1. Rename description → body_md, remove NOT NULL
ALTER TABLE posts RENAME COLUMN description TO body_md;
ALTER TABLE posts ALTER COLUMN body_md DROP NOT NULL;

-- 2. Drop old dev-specific columns
ALTER TABLE posts
  DROP COLUMN IF EXISTS type,
  DROP COLUMN IF EXISTS github_url,
  DROP COLUMN IF EXISTS tags;

-- 3. Add new niche-neutral columns
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'text'
    CHECK (format IN ('text','link','media','poll','showcase')),
  ADD COLUMN IF NOT EXISTS link_url    TEXT,
  ADD COLUMN IF NOT EXISTS is_nsfw     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_spoiler  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_oc       BOOLEAN NOT NULL DEFAULT false;

-- 4. Global tag pool
CREATE TABLE IF NOT EXISTS tags (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug           TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  description    TEXT,
  follower_count INTEGER NOT NULL DEFAULT 0,
  post_count     INTEGER NOT NULL DEFAULT 0,
  alias_of       UUID REFERENCES tags(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','deprecated','alias')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Post ↔ tag junction (max 5 enforced in app layer)
CREATE TABLE IF NOT EXISTS post_tags (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- 6. Showcase metadata (only populated when format = 'showcase')
CREATE TABLE IF NOT EXISTS showcase_meta (
  post_id  UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  repo_url TEXT,
  demo_url TEXT,
  links    JSONB DEFAULT '[]'::JSONB
);

-- 7. Per-room flair labels (like Reddit flair)
CREATE TABLE IF NOT EXISTS room_flairs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  color       TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  mod_only    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Post ↔ flair junction
CREATE TABLE IF NOT EXISTS post_flair (
  post_id  UUID NOT NULL REFERENCES posts(id)       ON DELETE CASCADE,
  flair_id UUID NOT NULL REFERENCES room_flairs(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, flair_id)
);

-- 9. RLS on every new table
ALTER TABLE tags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tags     ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcase_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_flairs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_flair    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select_all"        ON tags          FOR SELECT USING (true);
CREATE POLICY "tags_insert_auth"       ON tags          FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "tags_update_auth"       ON tags          FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "post_tags_select_all"   ON post_tags     FOR SELECT USING (true);
CREATE POLICY "post_tags_insert_auth"  ON post_tags     FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "post_tags_delete_own"   ON post_tags     FOR DELETE USING (
  auth.uid() = (SELECT user_id FROM posts WHERE id = post_tags.post_id)
);

CREATE POLICY "showcase_select_all"    ON showcase_meta FOR SELECT USING (true);
CREATE POLICY "showcase_insert_auth"   ON showcase_meta FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "showcase_update_own"    ON showcase_meta FOR UPDATE USING (
  auth.uid() = (SELECT user_id FROM posts WHERE id = showcase_meta.post_id)
);

CREATE POLICY "room_flairs_select_all" ON room_flairs   FOR SELECT USING (true);
CREATE POLICY "room_flairs_insert_own" ON room_flairs   FOR INSERT WITH CHECK (
  auth.uid() = (SELECT created_by FROM rooms WHERE id = room_flairs.room_id)
);

CREATE POLICY "post_flair_select_all"  ON post_flair    FOR SELECT USING (true);
CREATE POLICY "post_flair_insert_auth" ON post_flair    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 10. Seed the global dev tag pool
INSERT INTO tags (slug, name, description) VALUES
  ('rust',        'Rust',        'The Rust programming language'),
  ('typescript',  'TypeScript',  'TypeScript and JavaScript'),
  ('python',      'Python',      'Python programming language'),
  ('ai-ml',       'AI / ML',     'Artificial intelligence and machine learning'),
  ('webdev',      'Web Dev',     'Web development, frontend and backend'),
  ('devops',      'DevOps',      'Deployment, CI/CD, infrastructure'),
  ('open-source', 'Open Source', 'Open source projects and contributions'),
  ('gamedev',     'Game Dev',    'Game development and game engines'),
  ('mobile',      'Mobile',      'iOS, Android and cross-platform mobile'),
  ('databases',   'Databases',   'SQL, NoSQL and data storage'),
  ('security',    'Security',    'Cybersecurity and application security'),
  ('career',      'Career',      'Jobs, interviews and career growth'),
  ('linux',       'Linux',       'Linux, Unix and open-source operating systems'),
  ('cloud',       'Cloud',       'AWS, GCP, Azure and cloud infrastructure'),
  ('ui-ux',       'UI / UX',     'Design, interfaces and user experience')
ON CONFLICT (slug) DO NOTHING;
