-- ============================================================================
-- Private-room invite codes  +  24-hour post editing
-- ----------------------------------------------------------------------------
-- Two gaps closed:
--   A. Private rooms were a dead end — you could create one but nobody could
--      ever join. shareable_code existed on the table but was never populated
--      and there was no join path. Adds a code to every private room and a
--      SECURITY DEFINER RPC to join by code (the only way in, since non-members
--      can't even SELECT a private room under RLS).
--   B. Posts had no edit path. Adds edit_post — owner-only, title/body only,
--      allowed for 24h after creation — plus an edited_at marker. Delete stays
--      unrestricted via the existing posts_delete_own policy.
--
-- Both writes go through SECURITY DEFINER RPCs (the same pattern as vote_post
-- and the room-moderation functions), so no existing RLS policy is touched.
-- ============================================================================

-- ── A. Private-room invites ────────────────────────────────────────────────

-- Backfill a code for any private room that doesn't have one yet (10 hex chars).
UPDATE public.rooms
SET shareable_code = substr(md5(random()::text || id::text || clock_timestamp()::text), 1, 10)
WHERE type = 'private' AND shareable_code IS NULL;

-- Join a room using its invite code. SECURITY DEFINER so it can read the
-- private room (which the caller can't SELECT) and insert the membership row.
CREATE OR REPLACE FUNCTION public.join_room_by_code(p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_room rooms%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'Sign in to join a room.');
  END IF;

  SELECT * INTO v_room
  FROM rooms
  WHERE shareable_code = btrim(p_code)
  LIMIT 1;

  IF v_room.id IS NULL THEN
    RETURN json_build_object('error', 'That invite link is invalid or has expired.');
  END IF;

  -- The owner can always get back in; everyone else needs invites left on.
  IF v_room.allow_invites = false AND v_room.created_by <> v_uid THEN
    RETURN json_build_object('error', 'Invites are turned off for this room.');
  END IF;

  IF EXISTS (SELECT 1 FROM room_bans b WHERE b.room_id = v_room.id AND b.user_id = v_uid) THEN
    RETURN json_build_object('error', 'You can''t join this room.');
  END IF;

  INSERT INTO room_members (room_id, user_id, role)
  VALUES (v_room.id, v_uid, 'member')
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN json_build_object('success', true, 'room_name', v_room.name);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_room_by_code(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.join_room_by_code(text) TO authenticated;

-- ── B. 24-hour post editing ────────────────────────────────────────────────

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Edit a post's title/body. Owner-only, within 24h of creation. SECURITY
-- DEFINER so it can update exactly these two columns and nothing else — the
-- moderation columns and counters stay out of the caller's reach.
CREATE OR REPLACE FUNCTION public.edit_post(
  p_post_id uuid,
  p_title   text,
  p_body_md text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_post posts%ROWTYPE;
  v_title text := btrim(coalesce(p_title, ''));
  v_body  text := nullif(btrim(coalesce(p_body_md, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'Not signed in.');
  END IF;

  SELECT * INTO v_post FROM posts WHERE id = p_post_id;
  IF v_post.id IS NULL THEN
    RETURN json_build_object('error', 'Post not found.');
  END IF;

  IF v_post.user_id <> v_uid THEN
    RETURN json_build_object('error', 'You can only edit your own posts.');
  END IF;

  IF v_post.created_at < now() - interval '24 hours' THEN
    RETURN json_build_object('error', 'Posts can only be edited within 24 hours of posting.');
  END IF;

  IF v_title = '' THEN
    RETURN json_build_object('error', 'Title can''t be empty.');
  END IF;

  UPDATE posts
  SET title = v_title, body_md = v_body, edited_at = now()
  WHERE id = p_post_id;

  RETURN json_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.edit_post(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.edit_post(uuid, text, text) TO authenticated;
