-- ============================================================================
-- Fix: room joins were silently failing (FK violation on the clout trigger)
-- ----------------------------------------------------------------------------
-- trg_clout_on_room_join passed NEW.room_id into award_clout's p_target_user_id
-- argument. award_clout writes that into clout_transactions.target_user_id,
-- which is a FK to profiles(id). A room id is never a profile id, so the INSERT
-- aborted — and because the abort propagates up, the room_members INSERT that
-- fired the trigger failed too. Net effect: nobody could join any room, and
-- even room creators weren't recorded as members of their own rooms.
--
-- A room join has no "target user", so the correct value is NULL.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_clout_on_room_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- was: award_clout(NEW.user_id, 'join_room', 2, NULL, NULL, NEW.room_id)
  PERFORM award_clout(NEW.user_id, 'join_room', 2, NULL, NULL, NULL);
  RETURN NEW;
END;
$$;

-- Backfill: room creators who were never actually inserted as members because
-- the old trigger blew up during room creation.
INSERT INTO public.room_members (room_id, user_id, role)
SELECT r.id, r.created_by, 'owner'
FROM public.rooms r
WHERE NOT EXISTS (
  SELECT 1 FROM public.room_members m
  WHERE m.room_id = r.id AND m.user_id = r.created_by
)
ON CONFLICT (room_id, user_id) DO NOTHING;
