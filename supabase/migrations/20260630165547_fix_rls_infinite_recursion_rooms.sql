
-- Drop all broken SELECT policies on rooms and room_members
DROP POLICY IF EXISTS rooms_public_read   ON public.rooms;
DROP POLICY IF EXISTS rooms_select_public ON public.rooms;
DROP POLICY IF EXISTS room_members_select ON public.room_members;

-- Simple rooms SELECT: public rooms are visible to everyone; private rooms only to creator or members
-- Uses SECURITY DEFINER function to break the recursion cycle
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = p_room_id AND user_id = auth.uid()
  );
$$;

CREATE POLICY rooms_select ON public.rooms
  FOR SELECT USING (
    type = 'public'
    OR created_by = auth.uid()
    OR public.is_room_member(id)
  );

-- room_members SELECT: users can see their own memberships, and room owners/admins can see all members
CREATE POLICY room_members_select ON public.room_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = room_id AND r.created_by = auth.uid()
    )
  );
