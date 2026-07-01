
-- ============================================================
-- 1. award_badge_if_new
--    Insert badge + notification if the user hasn't earned it yet
-- ============================================================
CREATE OR REPLACE FUNCTION award_badge_if_new(p_user_id uuid, p_requirement text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_badge_id uuid;
BEGIN
  SELECT id INTO v_badge_id FROM badges WHERE requirement = p_requirement LIMIT 1;
  IF v_badge_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM user_badges WHERE user_id = p_user_id AND badge_id = v_badge_id) THEN RETURN; END IF;
  INSERT INTO user_badges (user_id, badge_id, unlocked_at) VALUES (p_user_id, v_badge_id, now());
  INSERT INTO notifications (user_id, type, badge_id) VALUES (p_user_id, 'badge_unlocked', v_badge_id);
END;
$$;

-- ============================================================
-- 2. check_and_award_badges
--    Run after every award_clout; check live data against badge conditions
-- ============================================================
CREATE OR REPLACE FUNCTION check_and_award_badges(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_score         integer;
  v_followers     integer;
  v_streak        integer;
  v_post_count    integer;
  v_comment_count integer;
  v_pioneer_count integer;
  v_user_rank     bigint;
BEGIN
  SELECT clout_score, follower_count, streak
  INTO v_score, v_followers, v_streak
  FROM profiles WHERE id = p_user_id;

  SELECT COUNT(*) INTO v_post_count    FROM posts    WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_comment_count FROM comments WHERE user_id = p_user_id;

  -- Clout milestones
  IF v_score >= 1000  THEN PERFORM award_badge_if_new(p_user_id, 'thousand_clout');     END IF;
  IF v_score >= 5000  THEN PERFORM award_badge_if_new(p_user_id, 'five_thousand_clout'); END IF;
  IF v_score >= 10000 THEN PERFORM award_badge_if_new(p_user_id, 'ten_thousand_clout'); END IF;

  -- Follower milestones
  IF v_followers >= 10  THEN PERFORM award_badge_if_new(p_user_id, 'ten_followers');       END IF;
  IF v_followers >= 50  THEN PERFORM award_badge_if_new(p_user_id, 'fifty_followers');     END IF;
  IF v_followers >= 200 THEN PERFORM award_badge_if_new(p_user_id, 'two_hundred_followers'); END IF;

  -- Post milestones
  IF v_post_count >= 1  THEN PERFORM award_badge_if_new(p_user_id, 'first_project'); END IF;
  IF v_post_count >= 10 THEN PERFORM award_badge_if_new(p_user_id, 'ten_ideas');     END IF;

  -- Comment milestones
  IF v_comment_count >= 25 THEN PERFORM award_badge_if_new(p_user_id, 'twenty_five_threads'); END IF;

  -- Streak milestones
  IF v_streak >= 7   THEN PERFORM award_badge_if_new(p_user_id, 'seven_day_streak');  END IF;
  IF v_streak >= 30  THEN PERFORM award_badge_if_new(p_user_id, 'thirty_day_streak'); END IF;
  IF v_streak >= 365 THEN PERFORM award_badge_if_new(p_user_id, 'year_streak');       END IF;

  -- Pioneer: first 100 users by signup order, total cap 100 badges
  SELECT COUNT(*) INTO v_pioneer_count
  FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
  WHERE b.requirement = 'first_hundred';

  IF v_pioneer_count < 100 THEN
    SELECT COUNT(*) INTO v_user_rank
    FROM profiles
    WHERE created_at <= (SELECT created_at FROM profiles WHERE id = p_user_id);
    IF v_user_rank <= 100 THEN
      PERFORM award_badge_if_new(p_user_id, 'first_hundred');
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- 3. update_streak
--    Increment / reset streak; award one-time milestone bonuses
-- ============================================================
CREATE OR REPLACE FUNCTION update_streak(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_last_date  date;
  v_old_streak integer;
  v_new_streak integer;
  v_bonus      integer;
BEGIN
  SELECT last_activity_date, streak INTO v_last_date, v_old_streak FROM profiles WHERE id = p_user_id;

  IF v_last_date = CURRENT_DATE THEN RETURN; END IF;  -- already counted today

  v_new_streak := CASE
    WHEN v_last_date = CURRENT_DATE - 1 THEN v_old_streak + 1
    ELSE 1
  END;

  UPDATE profiles SET streak = v_new_streak, last_activity_date = CURRENT_DATE WHERE id = p_user_id;

  -- One-time milestone bonus (bypass caps — it's a reward, not farmable)
  IF v_new_streak IN (7, 30, 100) THEN
    IF NOT EXISTS (
      SELECT 1 FROM clout_transactions
      WHERE user_id = p_user_id AND action_type = 'streak_milestone_' || v_new_streak
    ) THEN
      v_bonus := CASE v_new_streak WHEN 7 THEN 25 WHEN 30 THEN 100 WHEN 100 THEN 500 ELSE 0 END;
      INSERT INTO clout_transactions (user_id, action_type, clout_amount)
      VALUES (p_user_id, 'streak_milestone_' || v_new_streak, v_bonus);
      UPDATE profiles
      SET
        clout_score = clout_score + v_bonus,
        clout_tier  = CASE
          WHEN clout_score + v_bonus >= 10000 THEN 'legend'
          WHEN clout_score + v_bonus >= 2000  THEN 'influencer'
          WHEN clout_score + v_bonus >= 500   THEN 'contributor'
          ELSE 'novice'
        END
      WHERE id = p_user_id;
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- 4. award_clout — the main clout engine
-- ============================================================
CREATE OR REPLACE FUNCTION award_clout(
  p_user_id           uuid,
  p_action_type       text,
  p_base_amount       integer,
  p_target_post_id    uuid DEFAULT NULL,
  p_target_comment_id uuid DEFAULT NULL,
  p_target_user_id    uuid DEFAULT NULL
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_daily_cap      integer;
  v_already_earned integer;
  v_global_daily   integer;
  v_account_hours  numeric;
  v_streak         integer;
  v_multiplier     numeric(4,2);
  v_final_amount   integer;
  v_new_score      integer;
BEGIN
  -- 1. Action-level daily cap
  v_daily_cap := CASE p_action_type
    WHEN 'post_created'    THEN 45   -- 3 posts × 15
    WHEN 'post_upvoted'    THEN 150  -- 50 upvotes × 3
    WHEN 'comment_created' THEN 50   -- 10 comments × 5
    WHEN 'comment_upvoted' THEN 40   -- 20 upvotes × 2
    WHEN 'gained_follower' THEN 10   -- 10 followers × 1
    WHEN 'join_room'       THEN 10   -- 5 rooms × 2
    ELSE p_base_amount
  END;

  SELECT COALESCE(SUM(clout_amount), 0) INTO v_already_earned
  FROM clout_transactions
  WHERE user_id = p_user_id AND action_type = p_action_type AND created_at >= CURRENT_DATE;

  IF v_already_earned >= v_daily_cap THEN RETURN 0; END IF;

  -- 2. Room join: one-time per room (not just daily)
  IF p_action_type = 'join_room' AND p_target_user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM clout_transactions
      WHERE user_id = p_user_id AND action_type = 'join_room' AND target_user_id = p_target_user_id
    ) THEN RETURN 0; END IF;
  END IF;

  -- 3. Global 200/day hard cap
  SELECT COALESCE(SUM(clout_amount), 0) INTO v_global_daily
  FROM clout_transactions
  WHERE user_id = p_user_id AND created_at >= CURRENT_DATE;

  IF v_global_daily >= 200 THEN RETURN 0; END IF;

  -- 4. New-account gate (<24h → 50/day cap)
  SELECT EXTRACT(EPOCH FROM (now() - created_at)) / 3600.0 INTO v_account_hours
  FROM profiles WHERE id = p_user_id;

  IF v_account_hours < 24 AND v_global_daily >= 50 THEN RETURN 0; END IF;

  -- 5. Streak multiplier
  SELECT streak INTO v_streak FROM profiles WHERE id = p_user_id;
  v_multiplier := CASE
    WHEN v_streak >= 100 THEN 2.00
    WHEN v_streak >= 30  THEN 1.50
    WHEN v_streak >= 14  THEN 1.25
    WHEN v_streak >= 7   THEN 1.10
    ELSE 1.00
  END;

  -- 6. Compute final amount, clamped to all caps
  v_final_amount := LEAST(
    GREATEST(ROUND(p_base_amount * v_multiplier)::integer, p_base_amount),
    v_daily_cap - v_already_earned,
    200 - v_global_daily,
    CASE WHEN v_account_hours < 24 THEN GREATEST(50 - v_global_daily, 0) ELSE 999 END
  );

  IF v_final_amount <= 0 THEN RETURN 0; END IF;

  -- 7. Log the transaction
  INSERT INTO clout_transactions
    (user_id, action_type, clout_amount, target_post_id, target_comment_id, target_user_id)
  VALUES
    (p_user_id, p_action_type, v_final_amount, p_target_post_id, p_target_comment_id, p_target_user_id);

  -- 8. Update clout_score + recalculate tier
  SELECT clout_score + v_final_amount INTO v_new_score FROM profiles WHERE id = p_user_id;

  UPDATE profiles
  SET
    clout_score = v_new_score,
    clout_tier  = CASE
      WHEN v_new_score >= 10000 THEN 'legend'
      WHEN v_new_score >= 2000  THEN 'influencer'
      WHEN v_new_score >= 500   THEN 'contributor'
      ELSE 'novice'
    END
  WHERE id = p_user_id;

  -- 9. Upsert daily activity record
  INSERT INTO user_daily_activity (user_id, activity_date, actions_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, activity_date)
  DO UPDATE SET actions_count = user_daily_activity.actions_count + 1;

  -- 10. Streak maintenance
  PERFORM update_streak(p_user_id);

  -- 11. Badge check
  PERFORM check_and_award_badges(p_user_id);

  RETURN v_final_amount;
END;
$$;

-- ============================================================
-- 5. vote_post — updated to award clout to post author on upvote
-- ============================================================
CREATE OR REPLACE FUNCTION vote_post(p_post_id uuid, p_direction integer)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_user_id         uuid    := auth.uid();
  v_author_id       uuid;
  v_existing_rating integer;
  v_old_direction   integer;
  v_clout_delta     integer := 0;
  v_final_direction integer := p_direction;
BEGIN
  IF v_user_id IS NULL THEN RETURN json_build_object('error', 'Not authenticated'); END IF;
  IF p_direction NOT IN (1, -1) THEN RETURN json_build_object('error', 'Direction must be 1 or -1'); END IF;

  SELECT user_id INTO v_author_id FROM posts WHERE id = p_post_id;
  IF v_author_id = v_user_id THEN RETURN json_build_object('error', 'Cannot vote on your own post'); END IF;

  SELECT rating INTO v_existing_rating FROM post_ratings WHERE post_id = p_post_id AND user_id = v_user_id;

  IF v_existing_rating IS NULL THEN
    -- Fresh vote
    INSERT INTO post_ratings (post_id, user_id, rating)
    VALUES (p_post_id, v_user_id, CASE WHEN p_direction = 1 THEN 5 ELSE 1 END);
    v_clout_delta := p_direction;
    IF p_direction = 1 AND v_author_id IS NOT NULL THEN
      PERFORM award_clout(v_author_id, 'post_upvoted', 3, p_post_id, NULL, v_user_id);
    END IF;
  ELSE
    v_old_direction := CASE WHEN v_existing_rating = 5 THEN 1 ELSE -1 END;
    IF p_direction = v_old_direction THEN
      -- Toggle off — no clout change for author
      DELETE FROM post_ratings WHERE post_id = p_post_id AND user_id = v_user_id;
      v_clout_delta     := -v_old_direction;
      v_final_direction := 0;
    ELSE
      -- Switch direction
      UPDATE post_ratings SET rating = CASE WHEN p_direction = 1 THEN 5 ELSE 1 END
      WHERE post_id = p_post_id AND user_id = v_user_id;
      v_clout_delta := p_direction - v_old_direction;
      -- Award if switching TO an upvote (downvote→upvote)
      IF p_direction = 1 AND v_author_id IS NOT NULL THEN
        PERFORM award_clout(v_author_id, 'post_upvoted', 3, p_post_id, NULL, v_user_id);
      END IF;
    END IF;
  END IF;

  IF v_clout_delta != 0 THEN
    UPDATE posts SET clout = clout + v_clout_delta WHERE id = p_post_id;
  END IF;

  RETURN json_build_object('success', true, 'delta', v_clout_delta, 'direction', v_final_direction);
END;
$function$;

-- ============================================================
-- 6. Trigger functions
-- ============================================================

-- Post created → +15, with 30-min spacing guard
CREATE OR REPLACE FUNCTION trg_clout_on_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_last_post timestamptz;
BEGIN
  SELECT MAX(created_at) INTO v_last_post
  FROM posts WHERE user_id = NEW.user_id AND id != NEW.id;
  IF v_last_post IS NULL OR now() - v_last_post >= interval '30 minutes' THEN
    PERFORM award_clout(NEW.user_id, 'post_created', 15, NEW.id, NULL, NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clout_post_insert
AFTER INSERT ON posts
FOR EACH ROW EXECUTE FUNCTION trg_clout_on_post();

-- Comment created → +5, with 20-char quality gate
CREATE OR REPLACE FUNCTION trg_clout_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF length(trim(NEW.content)) >= 20 THEN
    PERFORM award_clout(NEW.user_id, 'comment_created', 5, NEW.post_id, NEW.id, NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clout_comment_insert
AFTER INSERT ON comments
FOR EACH ROW EXECUTE FUNCTION trg_clout_on_comment();

-- Follow → +1 to the person being followed
CREATE OR REPLACE FUNCTION trg_clout_on_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM award_clout(NEW.following_id, 'gained_follower', 1, NULL, NULL, NEW.follower_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clout_follow_insert
AFTER INSERT ON follows
FOR EACH ROW EXECUTE FUNCTION trg_clout_on_follow();

-- Room join → +2 (one-time per room; room_id passed via target_user_id slot)
CREATE OR REPLACE FUNCTION trg_clout_on_room_join()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM award_clout(NEW.user_id, 'join_room', 2, NULL, NULL, NEW.room_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clout_room_join
AFTER INSERT ON room_members
FOR EACH ROW EXECUTE FUNCTION trg_clout_on_room_join();
