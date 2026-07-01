
-- ── post_images table ────────────────────────────────────────────────────────
CREATE TABLE post_images (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       uuid        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  storage_path  text        NOT NULL,
  public_url    text        NOT NULL,
  display_order integer     NOT NULL DEFAULT 0,
  width         integer,
  height        integer,
  caption       text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_post_images_post ON post_images(post_id, display_order);

ALTER TABLE post_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_images_select_all" ON post_images
  FOR SELECT USING (true);

CREATE POLICY "post_images_insert_own" ON post_images
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT user_id FROM posts WHERE id = post_id)
  );

CREATE POLICY "post_images_delete_own" ON post_images
  FOR DELETE USING (
    auth.uid() = (SELECT user_id FROM posts WHERE id = post_id)
  );

-- ── Storage bucket ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-images',
  'post-images',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/gif','image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "post_images_storage_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'post-images');

CREATE POLICY "post_images_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'post-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "post_images_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'post-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
