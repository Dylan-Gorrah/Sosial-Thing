
ALTER TABLE public.posts
  ADD CONSTRAINT posts_room_id_fkey
  FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL;
