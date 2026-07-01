
-- ── vote_post ─────────────────────────────────────────────────────────────────
-- Atomic: reads auth.uid() from JWT (no user_id param), handles toggle,
-- switch, and self-vote prevention in a single transaction.
-- rating 5 = upvote, rating 1 = downvote (fits the existing 1-5 CHECK).
CREATE OR REPLACE FUNCTION public.vote_post(
  p_post_id  uuid,
  p_direction integer   -- 1 = up, -1 = down
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid    := auth.uid();
  v_existing_rating integer;
  v_old_direction   integer;
  v_clout_delta     integer := 0;
  v_final_direction integer := p_direction;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  IF p_direction NOT IN (1, -1) THEN
    RETURN json_build_object('error', 'Direction must be 1 or -1');
  END IF;

  -- Self-vote prevention
  IF EXISTS (SELECT 1 FROM posts WHERE id = p_post_id AND user_id = v_user_id) THEN
    RETURN json_build_object('error', 'Cannot vote on your own post');
  END IF;

  SELECT rating INTO v_existing_rating
  FROM post_ratings
  WHERE post_id = p_post_id AND user_id = v_user_id;

  IF v_existing_rating IS NULL THEN
    -- No existing vote → insert
    INSERT INTO post_ratings (post_id, user_id, rating)
    VALUES (p_post_id, v_user_id, CASE WHEN p_direction = 1 THEN 5 ELSE 1 END);
    v_clout_delta := p_direction;

  ELSE
    v_old_direction := CASE WHEN v_existing_rating = 5 THEN 1 ELSE -1 END;

    IF p_direction = v_old_direction THEN
      -- Same direction → toggle off (unvote)
      DELETE FROM post_ratings WHERE post_id = p_post_id AND user_id = v_user_id;
      v_clout_delta     := -v_old_direction;
      v_final_direction := 0;
    ELSE
      -- Different direction → switch vote
      UPDATE post_ratings
      SET rating = CASE WHEN p_direction = 1 THEN 5 ELSE 1 END
      WHERE post_id = p_post_id AND user_id = v_user_id;
      v_clout_delta := p_direction - v_old_direction;  -- e.g. -1→+1 = delta 2
    END IF;
  END IF;

  IF v_clout_delta != 0 THEN
    UPDATE posts SET clout = clout + v_clout_delta WHERE id = p_post_id;
  END IF;

  RETURN json_build_object(
    'success',   true,
    'delta',     v_clout_delta,
    'direction', v_final_direction
  );
END;
$$;

-- ── comment_count triggers ────────────────────────────────────────────────────
-- Keeps posts.comment_count accurate without a manual +1 in application code.
CREATE OR REPLACE FUNCTION public.on_comment_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_count_insert ON comments;
CREATE TRIGGER trg_comment_count_insert
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION public.on_comment_insert();

CREATE OR REPLACE FUNCTION public.on_comment_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_count_delete ON comments;
CREATE TRIGGER trg_comment_count_delete
  AFTER DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION public.on_comment_delete();

-- ── post_ratings RLS ──────────────────────────────────────────────────────────
-- Allow authenticated users to read their own ratings so the client can
-- display the current user's vote state on the feed and post page.
-- All writes go through vote_post (SECURITY DEFINER) so no write policies needed.
DROP POLICY IF EXISTS "users_read_own_ratings" ON post_ratings;
CREATE POLICY "users_read_own_ratings" ON post_ratings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
