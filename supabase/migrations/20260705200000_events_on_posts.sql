-- ============================================================================
-- Events are posts — not a parallel content system.
-- ----------------------------------------------------------------------------
-- A post can be flagged as an event with a start time. Everything a post
-- already has (image gallery = the poster, comments, votes, room context,
-- share/OG cards) works for events for free. The Explore page surfaces
-- upcoming events that are *relevant* to you: posted in rooms you joined or
-- by people you follow.
--
-- (Applied to the live project via MCP as "events_on_posts" on 2026-07-05;
-- this file mirrors it so the repo's migration history stays in sync.)
-- ============================================================================

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_event boolean NOT NULL DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS event_starts_at timestamptz;

-- Partial index: the events rail always filters is_event + orders by start time
CREATE INDEX IF NOT EXISTS idx_posts_events
  ON public.posts (event_starts_at)
  WHERE is_event;
