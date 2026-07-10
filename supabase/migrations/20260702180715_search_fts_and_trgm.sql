
-- Real search: Postgres FTS for posts (ranked), trigram indexes for
-- fuzzy name matching on people / tags / rooms.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Weighted tsvector: title counts more than body
ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body_md, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_posts_search_tsv      ON posts    USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm ON profiles USING GIN (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_display_trgm  ON profiles USING GIN (display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tags_name_trgm         ON tags     USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_rooms_name_trgm        ON rooms    USING GIN (name gin_trgm_ops);

-- Ranked post search. Not SECURITY DEFINER — runs as the caller, so RLS applies.
-- websearch_to_tsquery handles quoted phrases and -exclusions; the ILIKE arm
-- catches prefixes/short queries FTS misses ("rus" → "rust post").
CREATE OR REPLACE FUNCTION search_posts(p_query text, p_limit integer DEFAULT 30)
RETURNS TABLE (
  id            uuid,
  title         text,
  format        text,
  clout         integer,
  comment_count integer,
  verified      boolean,
  slop_status   text,
  created_at    timestamptz,
  username      text,
  display_name  text,
  rank          real
)
LANGUAGE sql STABLE AS $$
  WITH q AS (SELECT websearch_to_tsquery('english', p_query) AS tsq)
  SELECT
    p.id, p.title, p.format, p.clout, p.comment_count, p.verified, p.slop_status,
    p.created_at, pr.username, pr.display_name,
    ts_rank(p.search_tsv, q.tsq) AS rank
  FROM posts p
  JOIN profiles pr ON pr.id = p.user_id
  CROSS JOIN q
  WHERE q.tsq @@ p.search_tsv
     OR p.title ILIKE '%' || p_query || '%'
  ORDER BY (q.tsq @@ p.search_tsv)::int DESC, rank DESC, p.clout DESC
  LIMIT p_limit;
$$;
