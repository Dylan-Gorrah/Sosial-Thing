
-- ── unique room names (slug-based URLs) ──────────────────────────────────────
ALTER TABLE rooms ADD CONSTRAINT rooms_name_unique UNIQUE (name);

-- ── rooms RLS ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rooms_public_read"   ON rooms;
DROP POLICY IF EXISTS "rooms_insert"        ON rooms;
DROP POLICY IF EXISTS "rooms_owner_update"  ON rooms;

-- Public rooms visible to everyone; private rooms visible to members/owner
CREATE POLICY "rooms_public_read" ON rooms
  FOR SELECT USING (
    type = 'public'
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = id AND rm.user_id = auth.uid())
  );

CREATE POLICY "rooms_insert" ON rooms
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "rooms_owner_update" ON rooms
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM room_members rm
      WHERE rm.room_id = id AND rm.user_id = auth.uid() AND rm.role IN ('owner','admin')
    )
  );

-- ── room_members RLS ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "room_members_read"  ON room_members;
DROP POLICY IF EXISTS "room_members_join"  ON room_members;
DROP POLICY IF EXISTS "room_members_leave" ON room_members;

-- Members of public rooms are readable by anyone; private room members only by fellow members
CREATE POLICY "room_members_read" ON room_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_id AND r.type = 'public')
  );

CREATE POLICY "room_members_join" ON room_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "room_members_leave" ON room_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── member_count trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.on_room_member_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE rooms SET member_count = member_count + 1 WHERE id = NEW.room_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE rooms SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.room_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_room_member_insert ON room_members;
CREATE TRIGGER trg_room_member_insert
  AFTER INSERT ON room_members
  FOR EACH ROW EXECUTE FUNCTION public.on_room_member_change();

DROP TRIGGER IF EXISTS trg_room_member_delete ON room_members;
CREATE TRIGGER trg_room_member_delete
  AFTER DELETE ON room_members
  FOR EACH ROW EXECUTE FUNCTION public.on_room_member_change();
