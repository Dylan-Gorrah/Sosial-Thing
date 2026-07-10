
-- A vote cycle (up → un → up) must not re-award clout. One award per
-- (voter, item) pair, ever — tracked in clout_transactions.

CREATE OR REPLACE FUNCTION vote_post(p_post_id uuid, p_direction integer)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_user_id         uuid    := auth.uid();
  v_author_id       uuid;
  v_verified        boolean;
  v_upvote_base     integer;
  v_existing_rating integer;
  v_old_direction   integer;
  v_clout_delta     integer := 0;
  v_final_direction integer := p_direction;
BEGIN
  IF v_user_id IS NULL THEN RETURN json_build_object('error', 'Not authenticated'); END IF;
  IF p_direction NOT IN (1, -1) THEN RETURN json_build_object('error', 'Direction must be 1 or -1'); END IF;

  SELECT user_id, verified INTO v_author_id, v_verified FROM posts WHERE id = p_post_id;
  IF v_author_id = v_user_id THEN RETURN json_build_object('error', 'Cannot vote on your own post'); END IF;

  v_upvote_base := CASE WHEN v_verified THEN 5 ELSE 3 END;

  SELECT rating INTO v_existing_rating FROM post_ratings WHERE post_id = p_post_id AND user_id = v_user_id;

  IF v_existing_rating IS NULL THEN
    INSERT INTO post_ratings (post_id, user_id, rating)
    VALUES (p_post_id, v_user_id, CASE WHEN p_direction = 1 THEN 5 ELSE 1 END);
    v_clout_delta := p_direction;
  ELSE
    v_old_direction := CASE WHEN v_existing_rating = 5 THEN 1 ELSE -1 END;
    IF p_direction = v_old_direction THEN
      DELETE FROM post_ratings WHERE post_id = p_post_id AND user_id = v_user_id;
      v_clout_delta     := -v_old_direction;
      v_final_direction := 0;
    ELSE
      UPDATE post_ratings SET rating = CASE WHEN p_direction = 1 THEN 5 ELSE 1 END
      WHERE post_id = p_post_id AND user_id = v_user_id;
      v_clout_delta := p_direction - v_old_direction;
    END IF;
  END IF;

  -- Award only on an upvote this voter has never been paid for before
  IF v_final_direction = 1 AND v_author_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM clout_transactions
    WHERE action_type = 'post_upvoted' AND target_post_id = p_post_id AND target_user_id = v_user_id
  ) THEN
    PERFORM award_clout(v_author_id, 'post_upvoted', v_upvote_base, p_post_id, NULL, v_user_id);
  END IF;

  IF v_clout_delta != 0 THEN
    UPDATE posts SET clout = clout + v_clout_delta WHERE id = p_post_id;
  END IF;

  RETURN json_build_object('success', true, 'delta', v_clout_delta, 'direction', v_final_direction);
END;
$function$;

CREATE OR REPLACE FUNCTION vote_comment(p_comment_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_author_id  uuid;
  v_post_id    uuid;
  v_like_count integer;
BEGIN
  IF v_user_id IS NULL THEN RETURN json_build_object('error', 'Not authenticated'); END IF;

  SELECT user_id, post_id INTO v_author_id, v_post_id FROM comments WHERE id = p_comment_id;
  IF v_author_id IS NULL THEN RETURN json_build_object('error', 'Comment not found'); END IF;
  IF v_author_id = v_user_id THEN RETURN json_build_object('error', 'Cannot like your own comment'); END IF;

  IF EXISTS (SELECT 1 FROM comment_likes WHERE comment_id = p_comment_id AND user_id = v_user_id) THEN
    DELETE FROM comment_likes WHERE comment_id = p_comment_id AND user_id = v_user_id;
    UPDATE comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = p_comment_id
    RETURNING like_count INTO v_like_count;
    RETURN json_build_object('success', true, 'liked', false, 'like_count', v_like_count);
  END IF;

  INSERT INTO comment_likes (comment_id, user_id) VALUES (p_comment_id, v_user_id);
  UPDATE comments SET like_count = like_count + 1 WHERE id = p_comment_id
  RETURNING like_count INTO v_like_count;

  -- One award per (liker, comment), ever — re-like cycles earn nothing
  IF NOT EXISTS (
    SELECT 1 FROM clout_transactions
    WHERE action_type = 'comment_upvoted' AND target_comment_id = p_comment_id AND target_user_id = v_user_id
  ) THEN
    PERFORM award_clout(v_author_id, 'comment_upvoted', 2, v_post_id, p_comment_id, v_user_id);
  END IF;

  IF v_like_count >= 3 AND NOT EXISTS (
    SELECT 1 FROM clout_transactions
    WHERE action_type = 'comment_quality_bonus' AND target_comment_id = p_comment_id
  ) THEN
    PERFORM award_clout(v_author_id, 'comment_quality_bonus', 5, v_post_id, p_comment_id, NULL);
  END IF;

  RETURN json_build_object('success', true, 'liked', true, 'like_count', v_like_count);
END;
$$;
