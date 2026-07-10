
-- Leaderboards are queries over the clout_transactions ledger, not stored state.
-- SECURITY DEFINER because the ledger's RLS is own-rows-only: this function is
-- the controlled window that exposes aggregates, never raw earnings.

CREATE INDEX IF NOT EXISTS idx_clout_tx_created ON clout_transactions(created_at DESC);

CREATE OR REPLACE FUNCTION get_leaderboard(
  p_category text    DEFAULT 'clout',   -- 'clout' | 'builders' | 'community'
  p_days     integer DEFAULT 7,         -- window size in days; 0 = all-time
  p_room_id  uuid    DEFAULT NULL,      -- scope to clout earned inside one room
  p_limit    integer DEFAULT 20
)
RETURNS TABLE (
  rank           bigint,
  prev_rank      bigint,                -- rank in the previous window (NULL = new / all-time)
  user_id        uuid,
  username       text,
  display_name   text,
  avatar_url     text,
  clout_tier     text,
  total          bigint,
  verified_posts bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH filtered AS (
    SELECT ct.user_id, ct.clout_amount, ct.created_at
    FROM clout_transactions ct
    LEFT JOIN posts p ON p.id = ct.target_post_id
    WHERE (p_room_id IS NULL OR p.room_id = p_room_id)
      AND CASE p_category
        WHEN 'builders' THEN ct.action_type IN
          ('post_created','post_upvoted','post_verified','post_held_up')
        WHEN 'community' THEN ct.action_type IN
          ('comment_created','comment_upvoted','comment_quality_bonus',
           'verified_post','slop_flag_confirmed','verification_slashed','slop_flag_reversed')
        ELSE true
      END
  ),
  cur AS (
    SELECT f.user_id, SUM(f.clout_amount) AS total
    FROM filtered f
    WHERE p_days = 0 OR f.created_at >= now() - make_interval(days => p_days)
    GROUP BY f.user_id
    HAVING SUM(f.clout_amount) > 0
  ),
  prev AS (
    SELECT f.user_id, RANK() OVER (ORDER BY SUM(f.clout_amount) DESC) AS r
    FROM filtered f
    WHERE p_days > 0
      AND f.created_at >= now() - make_interval(days => 2 * p_days)
      AND f.created_at <  now() - make_interval(days => p_days)
    GROUP BY f.user_id
    HAVING SUM(f.clout_amount) > 0
  )
  SELECT
    RANK() OVER (ORDER BY cur.total DESC),
    prev.r,
    pr.id, pr.username, pr.display_name, pr.avatar_url, pr.clout_tier,
    cur.total,
    (SELECT COUNT(*) FROM posts vp WHERE vp.user_id = pr.id AND vp.verified)
  FROM cur
  JOIN profiles pr ON pr.id = cur.user_id
  LEFT JOIN prev ON prev.user_id = cur.user_id
  ORDER BY cur.total DESC, pr.username
  LIMIT p_limit;
$$;

-- The viewer's own rank, for the pinned "you" row when outside the top N.
CREATE OR REPLACE FUNCTION get_my_leaderboard_rank(
  p_category text    DEFAULT 'clout',
  p_days     integer DEFAULT 7,
  p_room_id  uuid    DEFAULT NULL
)
RETURNS TABLE (rank bigint, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH filtered AS (
    SELECT ct.user_id, ct.clout_amount
    FROM clout_transactions ct
    LEFT JOIN posts p ON p.id = ct.target_post_id
    WHERE (p_room_id IS NULL OR p.room_id = p_room_id)
      AND (p_days = 0 OR ct.created_at >= now() - make_interval(days => p_days))
      AND CASE p_category
        WHEN 'builders' THEN ct.action_type IN
          ('post_created','post_upvoted','post_verified','post_held_up')
        WHEN 'community' THEN ct.action_type IN
          ('comment_created','comment_upvoted','comment_quality_bonus',
           'verified_post','slop_flag_confirmed','verification_slashed','slop_flag_reversed')
        ELSE true
      END
  ),
  ranked AS (
    SELECT user_id, SUM(clout_amount) AS total,
           RANK() OVER (ORDER BY SUM(clout_amount) DESC) AS r
    FROM filtered
    GROUP BY user_id
    HAVING SUM(clout_amount) > 0
  )
  SELECT r, total FROM ranked WHERE user_id = auth.uid();
$$;
