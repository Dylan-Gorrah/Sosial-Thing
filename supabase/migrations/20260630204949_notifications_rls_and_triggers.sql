
-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Trigger: someone followed you
CREATE OR REPLACE FUNCTION notify_new_follower()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.follower_id = NEW.following_id THEN RETURN NEW; END IF;
  INSERT INTO notifications (user_id, type, actor_id)
  VALUES (NEW.following_id, 'new_follower', NEW.follower_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_follower
AFTER INSERT ON follows
FOR EACH ROW EXECUTE FUNCTION notify_new_follower();

-- Trigger: someone commented on your post
CREATE OR REPLACE FUNCTION notify_new_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_author_id uuid;
BEGIN
  SELECT user_id INTO v_author_id FROM posts WHERE id = NEW.post_id;
  IF v_author_id IS NULL OR v_author_id = NEW.user_id THEN RETURN NEW; END IF;
  INSERT INTO notifications (user_id, type, actor_id, post_id)
  VALUES (v_author_id, 'new_comment', NEW.user_id, NEW.post_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_comment
AFTER INSERT ON comments
FOR EACH ROW EXECUTE FUNCTION notify_new_comment();

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
