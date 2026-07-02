
-- ── room icon_url ────────────────────────────────────────────────────────────
ALTER TABLE rooms ADD COLUMN icon_url text;

-- ── Storage bucket ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'room-icons',
  'room-icons',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/gif','image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS — owner or admin of the room (folder = room id) can manage the icon
CREATE POLICY "room_icons_storage_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'room-icons');

CREATE POLICY "room_icons_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'room-icons' AND
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND (
          r.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM room_members rm
            WHERE rm.room_id = r.id AND rm.user_id = auth.uid() AND rm.role IN ('owner','admin')
          )
        )
    )
  );

CREATE POLICY "room_icons_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'room-icons' AND
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND (
          r.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM room_members rm
            WHERE rm.room_id = r.id AND rm.user_id = auth.uid() AND rm.role IN ('owner','admin')
          )
        )
    )
  );

CREATE POLICY "room_icons_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'room-icons' AND
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND (
          r.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM room_members rm
            WHERE rm.room_id = r.id AND rm.user_id = auth.uid() AND rm.role IN ('owner','admin')
          )
        )
    )
  );
