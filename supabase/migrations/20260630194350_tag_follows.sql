
-- tag_follows join table
CREATE TABLE tag_follows (
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tag_id     uuid NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, tag_id)
);

ALTER TABLE tag_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tag_follows_select" ON tag_follows FOR SELECT USING (true);
CREATE POLICY "tag_follows_insert" ON tag_follows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tag_follows_delete" ON tag_follows FOR DELETE USING (auth.uid() = user_id);

-- Trigger to keep tags.follower_count accurate
CREATE OR REPLACE FUNCTION update_tag_follow_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tags SET follower_count = follower_count + 1 WHERE id = NEW.tag_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tags SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.tag_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_tag_follow_count
AFTER INSERT OR DELETE ON tag_follows
FOR EACH ROW EXECUTE FUNCTION update_tag_follow_count();
