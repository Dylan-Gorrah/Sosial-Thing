-- ============================================================================
-- Fixes from the consistency audit (test1.md, 6 Sept 2026)
-- ----------------------------------------------------------------------------
-- Three things, all found by testing rather than reading:
--   1. tags.post_count was never maintained by anything, so Explore's tag rail
--      (which filters post_count > 0) was permanently empty.
--   2. The no_self_follow constraint was never actually applied — the migration
--      that "adds" it uses CREATE TABLE IF NOT EXISTS on a table that already
--      existed, so Postgres skipped the statement and every constraint in it.
--      Self-follows were possible and inflated both counters.
--   3. search_posts and get_landing_stats both counted moderator-removed posts.
--      The app-side listings are fixed in the same commit; these two are
--      database functions so they need fixing here.
-- ============================================================================

-- ── 1. tags.post_count ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_tag_post_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tags SET post_count = post_count + 1 WHERE id = NEW.tag_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tags SET post_count = GREATEST(post_count - 1, 0) WHERE id = OLD.tag_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Internal trigger function — never called over REST (matches the lockdown rule)
REVOKE EXECUTE ON FUNCTION public.update_tag_post_count() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_tag_post_count ON public.post_tags;
CREATE TRIGGER trg_tag_post_count
AFTER INSERT OR DELETE ON public.post_tags
FOR EACH ROW EXECUTE FUNCTION public.update_tag_post_count();

-- Backfill from the real rows. Removed posts don't count toward a tag's size.
UPDATE tags t SET post_count = (
  SELECT COUNT(*) FROM post_tags pt
  JOIN posts p ON p.id = pt.post_id
  WHERE pt.tag_id = t.id AND p.removed_at IS NULL
);

-- ── 2. no_self_follow ───────────────────────────────────────────────────────
-- Clear any existing self-follows first, or the constraint can't be added.
DELETE FROM public.follows WHERE follower_id = following_id;

ALTER TABLE public.follows
  DROP CONSTRAINT IF EXISTS no_self_follow;
ALTER TABLE public.follows
  ADD CONSTRAINT no_self_follow CHECK (follower_id <> following_id);

-- Repair any counters the self-follows inflated.
UPDATE profiles p SET
  follower_count  = (SELECT COUNT(*) FROM follows f WHERE f.following_id = p.id),
  following_count = (SELECT COUNT(*) FROM follows f WHERE f.follower_id  = p.id);

-- ── 3. Removed posts drop out of search and the public counters ─────────────
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
  WHERE p.removed_at IS NULL
    AND (q.tsq @@ p.search_tsv OR p.title ILIKE '%' || p_query || '%')
  ORDER BY (q.tsq @@ p.search_tsv)::int DESC, rank DESC, p.clout DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION get_landing_stats()
RETURNS json LANGUAGE sql STABLE AS $$
  SELECT json_build_object(
    'devs',     (SELECT COUNT(*) FROM profiles),
    'posts',    (SELECT COUNT(*) FROM posts    WHERE removed_at IS NULL),
    'comments', (SELECT COUNT(*) FROM comments),
    'clout',    (SELECT COALESCE(SUM(clout_score), 0) FROM profiles),
    'verified', (SELECT COUNT(*) FROM posts WHERE verified AND removed_at IS NULL)
  );
$$;
