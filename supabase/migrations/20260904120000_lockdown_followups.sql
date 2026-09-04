-- ============================================================================
-- Security lockdown, part 2 — close the gaps the first pass left open
-- ----------------------------------------------------------------------------
-- The lockdown migration (20260705120000) did two things: REVOKE EXECUTE on the
-- internal engine functions, and GRANT EXECUTE on the sanctioned RPC entry
-- points. Two gaps survived it:
--
--   1. Functions added AFTER it never got the revoke treatment.
--      `trg_post_rate_limit()` and `trg_comment_rate_limit()` (20260710130000)
--      are trigger functions — nothing should ever call them over REST — but
--      they are still executable by anon and authenticated.
--
--   2. GRANT is not REVOKE. Postgres grants EXECUTE to PUBLIC by default on
--      every new function, and the lockdown only ever *added* grants for
--      `authenticated`. The default PUBLIC grant was never removed, so `anon`
--      can still reach every mutating RPC: vote_post, verify_post, flag_slop,
--      file_report, resolve_report, remove_post, block_member, evict_member,
--      unblock_member. `join_room_by_code` and `edit_post` (20260705130000) are
--      the only two that got this right, and this migration copies their
--      pattern everywhere else.
--
-- Nothing here was exploitable: every one of those RPCs checks `auth.uid()`
-- (or an ownership predicate that fails closed for a null uid) and refuses an
-- anonymous caller. This is defence in depth and consistency with the
-- documented rule — an anonymous caller should not reach the entry point at
-- all, rather than reach it and be turned away inside.
--
-- Deliberately NOT revoked from anon:
--   * get_leaderboard        — the leaderboard, Explore rail and TopContributors
--                              all render for logged-out visitors
--   * is_room_member         — the rooms_select RLS policy calls it while anon
--                              browses rooms
--   * is_room_owner          — same, via the reports_select policy
--   * is_site_admin          — same; returns false for anon rather than erroring
--   Revoking any of those four turns an anonymous page load into a permission
--   error instead of an empty result.
-- ============================================================================

-- ── 1. Trigger functions: nobody calls these directly, ever ────────────────
REVOKE EXECUTE ON FUNCTION public.trg_post_rate_limit()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_comment_rate_limit() FROM PUBLIC, anon, authenticated;

-- ── 2. Mutating RPCs: authenticated only ───────────────────────────────────
-- Revoke the default PUBLIC grant (which is what leaks these to anon), then
-- re-grant to authenticated so the app keeps working.
DO $$
DECLARE
  fn text;
  authed_only text[] := ARRAY[
    'vote_post(uuid, integer)',
    'vote_comment(uuid)',
    'verify_post(uuid, text)',
    'flag_slop(uuid)',
    'file_report(uuid, uuid, text, text)',
    'resolve_report(uuid, text)',
    'remove_post(uuid, text)',
    'block_member(uuid, uuid, text)',
    'unblock_member(uuid, uuid)',
    'evict_member(uuid, uuid)',
    'get_my_leaderboard_rank(text, integer, uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY authed_only LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END $$;
