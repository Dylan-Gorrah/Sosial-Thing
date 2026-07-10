-- ============================================================================
-- Security lockdown — close the clout-economy forgery holes
-- ----------------------------------------------------------------------------
-- Three problems, all exploitable by any visitor holding the publishable key:
--   1. Internal SECURITY DEFINER engine functions (award_clout, etc.) were
--      callable via the auto-generated REST RPC endpoint by anon/authenticated,
--      letting anyone mint clout, badges, and streaks directly.
--   2. Four core tables had `WITH CHECK (true)` INSERT/ALL policies, letting
--      any authenticated user forge clout_transactions (→ leaderboard),
--      notifications, badges, and daily-activity/streak rows.
--   3. post_ratings write policies only checked `authenticated`, not ownership,
--      so votes could be inserted as any user — bypassing vote_post's self-vote
--      block, toggle logic, and anti-farming guards.
--
-- All legitimate writes to these tables happen inside SECURITY DEFINER
-- functions/triggers, which bypass RLS — so removing the loose row policies and
-- the public EXECUTE grants changes nothing for real app flows.
-- ============================================================================

-- ── 1. Revoke RPC access to the internal engine ────────────────────────────
-- These are called only by triggers, cron, or the sanctioned RPCs below — never
-- directly by the client. Trigger functions fire regardless of EXECUTE grants.
DO $$
DECLARE
  fn text;
  internal_fns text[] := ARRAY[
    -- clout / badge / streak engine
    'award_clout(uuid, text, integer, uuid, uuid, uuid)',
    'deduct_clout(uuid, text, integer, uuid)',
    'award_badge_if_new(uuid, text)',
    'check_and_award_badges(uuid)',
    'update_streak(uuid)',
    'run_held_up_bonuses()',
    -- trigger functions (no client should ever call these)
    'handle_new_user()',
    'notify_new_comment()',
    'notify_new_follower()',
    'on_comment_delete()',
    'on_comment_insert()',
    'on_room_member_change()',
    'trg_clout_on_comment()',
    'trg_clout_on_follow()',
    'trg_clout_on_post()',
    'trg_clout_on_room_join()',
    'trg_restricted_post_limit()',
    'update_follow_counts()',
    'update_tag_follow_count()',
    'update_updated_at_column()'
  ];
BEGIN
  FOREACH fn IN ARRAY internal_fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;

-- Sanctioned RPC entry points stay callable. They either validate the caller
-- internally (moderation checks is_room_owner; vote/verify/flag use auth.uid())
-- or only read public data. is_room_member/is_room_owner must stay executable
-- because RLS policies call them during query evaluation.
GRANT EXECUTE ON FUNCTION public.vote_post(uuid, integer)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.vote_comment(uuid)                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_post(uuid, text)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.flag_slop(uuid)                                TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_post(uuid, text)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_member(uuid, uuid, text)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_member(uuid, uuid)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.evict_member(uuid, uuid)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, integer, uuid, integer)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_leaderboard_rank(text, integer, uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_landing_stats()                            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_posts(text, integer)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_room_member(uuid)                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_room_owner(uuid)                            TO authenticated;

-- ── 2. Drop the always-true row policies ───────────────────────────────────
-- Every write to these tables is done by a SECURITY DEFINER function/trigger,
-- which bypasses RLS. With no INSERT policy, direct client inserts are denied.
DROP POLICY IF EXISTS "clout_insert"       ON public.clout_transactions;
DROP POLICY IF EXISTS "notifs_insert"      ON public.notifications;
DROP POLICY IF EXISTS "user_badges_insert" ON public.user_badges;
DROP POLICY IF EXISTS "activity_all"       ON public.user_daily_activity;

-- ── 3. Force all vote writes through vote_post ─────────────────────────────
-- Drop the direct insert/update/delete policies on post_ratings. vote_post
-- (SECURITY DEFINER) owns every legitimate write; the client never touches the
-- table directly. SELECT stays open so vote states can be read.
DROP POLICY IF EXISTS "ratings_insert_auth" ON public.post_ratings;
DROP POLICY IF EXISTS "ratings_update_own"  ON public.post_ratings;
DROP POLICY IF EXISTS "ratings_delete_own"  ON public.post_ratings;
-- Redundant second SELECT policy (duplicate of ratings_select_all) — remove to
-- clear the multiple-permissive-policies advisor warning.
DROP POLICY IF EXISTS "users_read_own_ratings" ON public.post_ratings;
