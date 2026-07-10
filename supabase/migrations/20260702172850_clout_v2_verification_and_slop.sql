
-- ════════════════════════════════════════════════════════════════
-- CLOUT v2 — rebalanced earning, peer verification, slop defense
-- Pay people for what others say about their work,
-- not for the work merely existing.
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- 1. Schema changes
-- ────────────────────────────────────────────────────────────────

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS verified          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS slop_status       TEXT NOT NULL DEFAULT 'none'
    CHECK (slop_status IN ('none','flagged','cleared')),
  ADD COLUMN IF NOT EXISTS slop_confirmed_at TIMESTAMPTZ;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trust_level TEXT NOT NULL DEFAULT 'standard'
    CHECK (trust_level IN ('standard','watch','restricted'));

-- Real comment likes (the old UI was local state only)
CREATE TABLE IF NOT EXISTS comment_likes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- Peer verification: "I checked, this build is real"
CREATE TABLE IF NOT EXISTS post_verifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  verifier_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  evidence    TEXT NOT NULL CHECK (evidence IN ('ran_demo','read_code','watched_it_work','saw_in_person')),
  weight      NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, verifier_id)
);

-- Slop flags: mass-produced low-effort content, distinct from abuse reports
CREATE TABLE IF NOT EXISTS slop_flags (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  flagger_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  weight     NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','reversed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, flagger_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment  ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user     ON comment_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_verifications_post ON post_verifications(post_id);
CREATE INDEX IF NOT EXISTS idx_slop_flags_post        ON slop_flags(post_id);
CREATE INDEX IF NOT EXISTS idx_clout_tx_user_day      ON clout_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clout_tx_target_post   ON clout_transactions(target_post_id);

-- RLS: reads are open where the UI needs them; ALL writes go through
-- SECURITY DEFINER functions, so no insert/update/delete policies.
ALTER TABLE comment_likes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE slop_flags         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comment_likes_select_all"  ON comment_likes      FOR SELECT USING (true);
CREATE POLICY "verifications_select_all"  ON post_verifications FOR SELECT USING (true);
-- Flags are only visible to the flagger (no retaliation targets)
CREATE POLICY "slop_flags_select_own"     ON slop_flags         FOR SELECT USING (auth.uid() = flagger_id);

-- ────────────────────────────────────────────────────────────────
-- 2. deduct_clout — negative transactions (slashing)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION deduct_clout(
  p_user_id        uuid,
  p_action_type    text,
  p_amount         integer,           -- positive number, stored negative
  p_target_post_id uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_new_score integer;
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;

  INSERT INTO clout_transactions (user_id, action_type, clout_amount, target_post_id)
  VALUES (p_user_id, p_action_type, -p_amount, p_target_post_id);

  SELECT GREATEST(clout_score - p_amount, 0) INTO v_new_score
  FROM profiles WHERE id = p_user_id;

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
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- 3. award_clout v2 — rebalanced caps, pair-wise cap, slop guards
-- ────────────────────────────────────────────────────────────────
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
  v_pair_earned    integer;
  v_trust          text;
  v_slop           text;
BEGIN
  -- 0a. Slop guard: posts in slop state earn nothing
  IF p_action_type IN ('post_created','post_upvoted','post_held_up','post_verified')
     AND p_target_post_id IS NOT NULL THEN
    SELECT slop_status INTO v_slop FROM posts WHERE id = p_target_post_id;
    IF v_slop = 'flagged' THEN RETURN 0; END IF;
  END IF;

  -- 0b. Trust guard: Watch/Restricted authors earn zero post clout
  --     until one of their posts gets verified
  IF p_action_type IN ('post_created','post_upvoted','post_held_up') THEN
    SELECT trust_level INTO v_trust FROM profiles WHERE id = p_user_id;
    IF v_trust IN ('watch','restricted') THEN RETURN 0; END IF;
  END IF;

  -- 1. Action-level daily cap (v2 rebalance: activity pays less,
  --    received quality signals pay more)
  v_daily_cap := CASE p_action_type
    WHEN 'post_created'          THEN 15   -- 3 posts × 5
    WHEN 'comment_created'       THEN 20   -- 10 comments × 2
    WHEN 'post_upvoted'          THEN 150  -- others judging you — keep generous
    WHEN 'comment_upvoted'       THEN 40   -- 20 upvotes × 2
    WHEN 'comment_quality_bonus' THEN 25   -- 5 bonuses × 5
    WHEN 'gained_follower'       THEN 10   -- 10 followers × 1
    WHEN 'join_room'             THEN 10   -- 5 rooms × 2
    WHEN 'verified_post'         THEN 15   -- verifier: 5 verifies × 3
    WHEN 'post_verified'         THEN 50   -- author: 2 verified posts × 25
    WHEN 'slop_flag_confirmed'   THEN 10   -- 5 confirmed flags × 2
    WHEN 'post_held_up'          THEN 25   -- 5 held-up posts × 5
    ELSE p_base_amount
  END;

  SELECT COALESCE(SUM(clout_amount), 0) INTO v_already_earned
  FROM clout_transactions
  WHERE user_id = p_user_id AND action_type = p_action_type
    AND clout_amount > 0 AND created_at >= CURRENT_DATE;

  IF v_already_earned >= v_daily_cap THEN RETURN 0; END IF;

  -- 2. Room join: one-time per room (room_id lives in target_user_id slot)
  IF p_action_type = 'join_room' AND p_target_user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM clout_transactions
      WHERE user_id = p_user_id AND action_type = 'join_room' AND target_user_id = p_target_user_id
    ) THEN RETURN 0; END IF;
  END IF;

  -- 3. Global 200/day hard cap
  SELECT COALESCE(SUM(clout_amount), 0) INTO v_global_daily
  FROM clout_transactions
  WHERE user_id = p_user_id AND clout_amount > 0 AND created_at >= CURRENT_DATE;

  IF v_global_daily >= 200 THEN RETURN 0; END IF;

  -- 4. New-account gate (<24h → 50/day cap)
  SELECT EXTRACT(EPOCH FROM (now() - created_at)) / 3600.0 INTO v_account_hours
  FROM profiles WHERE id = p_user_id;

  IF v_account_hours < 24 AND v_global_daily >= 50 THEN RETURN 0; END IF;

  -- 5. Pair-wise cap: max 10 clout/day sourced from any one other user.
  --    Kills two-account farming loops.
  v_pair_earned := 0;
  IF p_action_type IN ('post_upvoted','comment_upvoted','gained_follower')
     AND p_target_user_id IS NOT NULL THEN
    SELECT COALESCE(SUM(clout_amount), 0) INTO v_pair_earned
    FROM clout_transactions
    WHERE user_id = p_user_id
      AND target_user_id = p_target_user_id
      AND action_type IN ('post_upvoted','comment_upvoted','gained_follower')
      AND clout_amount > 0
      AND created_at >= CURRENT_DATE;
    IF v_pair_earned >= 10 THEN RETURN 0; END IF;
  END IF;

  -- 6. Streak multiplier
  SELECT streak INTO v_streak FROM profiles WHERE id = p_user_id;
  v_multiplier := CASE
    WHEN v_streak >= 100 THEN 2.00
    WHEN v_streak >= 30  THEN 1.50
    WHEN v_streak >= 14  THEN 1.25
    WHEN v_streak >= 7   THEN 1.10
    ELSE 1.00
  END;

  -- 7. Compute final amount, clamped to every cap
  v_final_amount := LEAST(
    GREATEST(ROUND(p_base_amount * v_multiplier)::integer, p_base_amount),
    v_daily_cap - v_already_earned,
    200 - v_global_daily,
    CASE WHEN v_account_hours < 24 THEN GREATEST(50 - v_global_daily, 0) ELSE 999 END,
    CASE
      WHEN p_action_type IN ('post_upvoted','comment_upvoted','gained_follower')
           AND p_target_user_id IS NOT NULL
      THEN 10 - v_pair_earned
      ELSE 999
    END
  );

  IF v_final_amount <= 0 THEN RETURN 0; END IF;

  -- 8. Log the transaction
  INSERT INTO clout_transactions
    (user_id, action_type, clout_amount, target_post_id, target_comment_id, target_user_id)
  VALUES
    (p_user_id, p_action_type, v_final_amount, p_target_post_id, p_target_comment_id, p_target_user_id);

  -- 9. Update clout_score + recalculate tier
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

  -- 10. Upsert daily activity record
  INSERT INTO user_daily_activity (user_id, activity_date, actions_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, activity_date)
  DO UPDATE SET actions_count = user_daily_activity.actions_count + 1;

  -- 11. Streak + badges
  PERFORM update_streak(p_user_id);
  PERFORM check_and_award_badges(p_user_id);

  RETURN v_final_amount;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- 4. Rebalanced triggers: post +5, comment +2
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_clout_on_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_last_post timestamptz;
BEGIN
  SELECT MAX(created_at) INTO v_last_post
  FROM posts WHERE user_id = NEW.user_id AND id != NEW.id;
  IF v_last_post IS NULL OR now() - v_last_post >= interval '30 minutes' THEN
    PERFORM award_clout(NEW.user_id, 'post_created', 5, NEW.id, NULL, NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trg_clout_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF length(trim(NEW.content)) >= 20 THEN
    PERFORM award_clout(NEW.user_id, 'comment_created', 2, NEW.post_id, NEW.id, NULL);
  END IF;
  RETURN NEW;
END;
$$;

-- Restricted authors are hard rate-limited: 3 posts/day
CREATE OR REPLACE FUNCTION trg_restricted_post_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT trust_level FROM profiles WHERE id = NEW.user_id) = 'restricted' THEN
    IF (SELECT COUNT(*) FROM posts WHERE user_id = NEW.user_id AND created_at >= CURRENT_DATE) >= 3 THEN
      RAISE EXCEPTION 'Daily posting limit reached';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restricted_post_limit ON posts;
CREATE TRIGGER trg_restricted_post_limit
BEFORE INSERT ON posts
FOR EACH ROW EXECUTE FUNCTION trg_restricted_post_limit();

-- ────────────────────────────────────────────────────────────────
-- 5. vote_post — verified posts earn upvote clout at 1.5x (3 → 5)
-- ────────────────────────────────────────────────────────────────
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

  -- Verified work quietly compounds
  v_upvote_base := CASE WHEN v_verified THEN 5 ELSE 3 END;

  SELECT rating INTO v_existing_rating FROM post_ratings WHERE post_id = p_post_id AND user_id = v_user_id;

  IF v_existing_rating IS NULL THEN
    INSERT INTO post_ratings (post_id, user_id, rating)
    VALUES (p_post_id, v_user_id, CASE WHEN p_direction = 1 THEN 5 ELSE 1 END);
    v_clout_delta := p_direction;
    IF p_direction = 1 AND v_author_id IS NOT NULL THEN
      PERFORM award_clout(v_author_id, 'post_upvoted', v_upvote_base, p_post_id, NULL, v_user_id);
    END IF;
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
      IF p_direction = 1 AND v_author_id IS NOT NULL THEN
        PERFORM award_clout(v_author_id, 'post_upvoted', v_upvote_base, p_post_id, NULL, v_user_id);
      END IF;
    END IF;
  END IF;

  IF v_clout_delta != 0 THEN
    UPDATE posts SET clout = clout + v_clout_delta WHERE id = p_post_id;
  END IF;

  RETURN json_build_object('success', true, 'delta', v_clout_delta, 'direction', v_final_direction);
END;
$function$;

-- ────────────────────────────────────────────────────────────────
-- 6. vote_comment — real, persistent comment likes
--    +2 to the author per like; +5 quality bonus at 3 likes
-- ────────────────────────────────────────────────────────────────
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
    -- Toggle off. No clout clawback — unliking earns/costs nothing.
    DELETE FROM comment_likes WHERE comment_id = p_comment_id AND user_id = v_user_id;
    UPDATE comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = p_comment_id
    RETURNING like_count INTO v_like_count;
    RETURN json_build_object('success', true, 'liked', false, 'like_count', v_like_count);
  END IF;

  INSERT INTO comment_likes (comment_id, user_id) VALUES (p_comment_id, v_user_id);
  UPDATE comments SET like_count = like_count + 1 WHERE id = p_comment_id
  RETURNING like_count INTO v_like_count;

  PERFORM award_clout(v_author_id, 'comment_upvoted', 2, v_post_id, p_comment_id, v_user_id);

  -- Good comments > many comments: one-time +5 at 3 likes
  IF v_like_count >= 3 AND NOT EXISTS (
    SELECT 1 FROM clout_transactions
    WHERE action_type = 'comment_quality_bonus' AND target_comment_id = p_comment_id
  ) THEN
    PERFORM award_clout(v_author_id, 'comment_quality_bonus', 5, v_post_id, p_comment_id, NULL);
  END IF;

  RETURN json_build_object('success', true, 'liked', true, 'like_count', v_like_count);
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- 7. verify_post — peer verification ("Built It")
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION verify_post(p_post_id uuid, p_evidence text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_author_id    uuid;
  v_verified     boolean;
  v_slop_status  text;
  v_clout        integer;
  v_prior        integer;
  v_weight       numeric(3,2);
  v_total        numeric;
  v_trust        text;
  v_flag         record;
BEGIN
  IF v_user_id IS NULL THEN RETURN json_build_object('error', 'Not authenticated'); END IF;
  IF p_evidence NOT IN ('ran_demo','read_code','watched_it_work','saw_in_person') THEN
    RETURN json_build_object('error', 'Invalid evidence type');
  END IF;

  SELECT user_id, verified, slop_status INTO v_author_id, v_verified, v_slop_status
  FROM posts WHERE id = p_post_id;
  IF v_author_id IS NULL THEN RETURN json_build_object('error', 'Post not found'); END IF;
  IF v_author_id = v_user_id THEN RETURN json_build_object('error', 'Cannot verify your own post'); END IF;

  -- Contributor+ only: privileges are earned, throwaways can't vouch
  SELECT clout_score INTO v_clout FROM profiles WHERE id = v_user_id;
  IF v_clout < 500 THEN
    RETURN json_build_object('error', 'You need Contributor status (500+ clout) to verify posts');
  END IF;

  IF EXISTS (SELECT 1 FROM post_verifications WHERE post_id = p_post_id AND verifier_id = v_user_id) THEN
    RETURN json_build_object('error', 'You already verified this post');
  END IF;

  -- Weight: repeat verifications of the same author decay 1.0 → 0.5 → 0.25;
  -- mutual follows count half. Friend-rings don't scale.
  SELECT COUNT(*) INTO v_prior
  FROM post_verifications pv JOIN posts p ON p.id = pv.post_id
  WHERE pv.verifier_id = v_user_id AND p.user_id = v_author_id;

  v_weight := CASE WHEN v_prior = 0 THEN 1.0 WHEN v_prior = 1 THEN 0.5 ELSE 0.25 END;

  IF EXISTS (SELECT 1 FROM follows WHERE follower_id = v_user_id AND following_id = v_author_id)
     AND EXISTS (SELECT 1 FROM follows WHERE follower_id = v_author_id AND following_id = v_user_id) THEN
    v_weight := v_weight / 2;
  END IF;

  INSERT INTO post_verifications (post_id, verifier_id, evidence, weight)
  VALUES (p_post_id, v_user_id, p_evidence, v_weight);

  -- Verifier earns +3 (capped at 5/day)
  PERFORM award_clout(v_user_id, 'verified_post', 3, p_post_id, NULL, v_author_id);

  SELECT COALESCE(SUM(weight), 0) INTO v_total FROM post_verifications WHERE post_id = p_post_id;

  -- 3 independent weight → verified
  IF v_total >= 3.0 AND NOT v_verified THEN
    UPDATE posts
    SET verified = true, verified_at = now(),
        slop_status = CASE WHEN slop_status = 'flagged' THEN 'cleared' ELSE slop_status END
    WHERE id = p_post_id;

    PERFORM award_clout(v_author_id, 'post_verified', 25, p_post_id, NULL, NULL);
    INSERT INTO notifications (user_id, type, post_id) VALUES (v_author_id, 'post_verified', p_post_id);

    -- Flag reversal: flagging verified work costs you
    FOR v_flag IN
      SELECT id, flagger_id FROM slop_flags WHERE post_id = p_post_id AND status IN ('pending','confirmed')
    LOOP
      UPDATE slop_flags SET status = 'reversed' WHERE id = v_flag.id;
      PERFORM deduct_clout(v_flag.flagger_id, 'slop_flag_reversed', 5, p_post_id);
    END LOOP;

    -- Redemption: a verified post steps trust back up
    SELECT trust_level INTO v_trust FROM profiles WHERE id = v_author_id;
    IF v_trust = 'watch' THEN
      UPDATE profiles SET trust_level = 'standard' WHERE id = v_author_id;
    ELSIF v_trust = 'restricted' THEN
      UPDATE profiles SET trust_level = 'watch' WHERE id = v_author_id;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'verified', (SELECT verified FROM posts WHERE id = p_post_id),
    'total_weight', v_total
  );
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- 8. flag_slop — the community's quality brake
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION flag_slop(p_post_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_author_id   uuid;
  v_verified    boolean;
  v_slop_status text;
  v_clout       integer;
  v_tier        text;
  v_weight      numeric(3,2);
  v_threshold   numeric;
  v_total       numeric;
  v_flag        record;
  v_verifier    record;
  v_recent      integer;
BEGIN
  IF v_user_id IS NULL THEN RETURN json_build_object('error', 'Not authenticated'); END IF;

  SELECT user_id, verified, slop_status INTO v_author_id, v_verified, v_slop_status
  FROM posts WHERE id = p_post_id;
  IF v_author_id IS NULL THEN RETURN json_build_object('error', 'Post not found'); END IF;
  IF v_author_id = v_user_id THEN RETURN json_build_object('error', 'Cannot flag your own post'); END IF;
  IF v_slop_status = 'flagged' THEN RETURN json_build_object('error', 'Post is already in slop state'); END IF;

  SELECT clout_score, clout_tier INTO v_clout, v_tier FROM profiles WHERE id = v_user_id;
  IF v_clout < 500 THEN
    RETURN json_build_object('error', 'You need Contributor status (500+ clout) to flag slop');
  END IF;

  IF EXISTS (SELECT 1 FROM slop_flags WHERE post_id = p_post_id AND flagger_id = v_user_id AND status != 'reversed') THEN
    RETURN json_build_object('error', 'You already flagged this post');
  END IF;

  -- Weight by tier
  v_weight := CASE v_tier WHEN 'legend' THEN 2.0 WHEN 'influencer' THEN 1.5 ELSE 1.0 END;

  INSERT INTO slop_flags (post_id, flagger_id, weight)
  VALUES (p_post_id, v_user_id, v_weight)
  ON CONFLICT (post_id, flagger_id) DO UPDATE SET status = 'pending', weight = EXCLUDED.weight, created_at = now();

  -- Verified posts need double the weight to take down
  v_threshold := CASE WHEN v_verified THEN 6.0 ELSE 3.0 END;

  SELECT COALESCE(SUM(weight), 0) INTO v_total
  FROM slop_flags WHERE post_id = p_post_id AND status = 'pending';

  IF v_total >= v_threshold THEN
    -- Slop confirmed: zero clout, out of Hot/Rising, author notified
    UPDATE posts
    SET slop_status = 'flagged', slop_confirmed_at = now(), verified = false, verified_at = NULL
    WHERE id = p_post_id;

    -- Skin in the game: vouching for garbage costs more than it earned
    IF v_verified THEN
      FOR v_verifier IN SELECT verifier_id FROM post_verifications WHERE post_id = p_post_id LOOP
        PERFORM deduct_clout(v_verifier.verifier_id, 'verification_slashed', 15, p_post_id);
      END LOOP;
      DELETE FROM post_verifications WHERE post_id = p_post_id;
    END IF;

    -- Confirmed flaggers earn +2
    FOR v_flag IN SELECT id, flagger_id FROM slop_flags WHERE post_id = p_post_id AND status = 'pending' LOOP
      UPDATE slop_flags SET status = 'confirmed' WHERE id = v_flag.id;
      PERFORM award_clout(v_flag.flagger_id, 'slop_flag_confirmed', 2, p_post_id, NULL, NULL);
    END LOOP;

    INSERT INTO notifications (user_id, type, post_id) VALUES (v_author_id, 'post_slop_flagged', p_post_id);

    -- Trust transitions: 2 confirmed in 30 days → Watch, 4 → Restricted
    SELECT COUNT(*) INTO v_recent
    FROM posts
    WHERE user_id = v_author_id AND slop_status = 'flagged'
      AND slop_confirmed_at > now() - interval '30 days';

    IF v_recent >= 4 THEN
      UPDATE profiles SET trust_level = 'restricted' WHERE id = v_author_id;
    ELSIF v_recent >= 2 THEN
      UPDATE profiles SET trust_level = 'watch' WHERE id = v_author_id AND trust_level = 'standard';
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'slop_confirmed', (SELECT slop_status = 'flagged' FROM posts WHERE id = p_post_id),
    'total_weight', v_total
  );
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- 9. The 48h "held up" bonus — quality that lasts, via pg_cron
-- ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION run_held_up_bonuses()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_post    record;
  v_awarded integer := 0;
BEGIN
  FOR v_post IN
    SELECT p.id, p.user_id
    FROM posts p
    WHERE p.created_at <= now() - interval '48 hours'
      AND p.created_at >  now() - interval '14 days'
      AND p.slop_status != 'flagged'
      AND (p.clout >= 3 OR p.comment_count >= 2)
      AND NOT EXISTS (
        SELECT 1 FROM slop_flags sf
        WHERE sf.post_id = p.id AND sf.status != 'reversed'
      )
      AND NOT EXISTS (
        SELECT 1 FROM clout_transactions ct
        WHERE ct.action_type = 'post_held_up' AND ct.target_post_id = p.id
      )
  LOOP
    IF award_clout(v_post.user_id, 'post_held_up', 5, v_post.id, NULL, NULL) > 0 THEN
      v_awarded := v_awarded + 1;
    END IF;
  END LOOP;
  RETURN v_awarded;
END;
$$;

SELECT cron.schedule('clout-held-up-bonus', '30 * * * *', 'SELECT run_held_up_bonuses()');
