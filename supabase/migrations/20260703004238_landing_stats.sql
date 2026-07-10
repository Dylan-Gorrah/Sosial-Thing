
-- Live counters for the landing page. One round trip, caller RLS
-- (all counted tables are public-select anyway).
CREATE OR REPLACE FUNCTION get_landing_stats()
RETURNS json LANGUAGE sql STABLE AS $$
  SELECT json_build_object(
    'devs',     (SELECT COUNT(*) FROM profiles),
    'posts',    (SELECT COUNT(*) FROM posts),
    'comments', (SELECT COUNT(*) FROM comments),
    'clout',    (SELECT COALESCE(SUM(clout_score), 0) FROM profiles),
    'verified', (SELECT COUNT(*) FROM posts WHERE verified)
  );
$$;
