-- posts.removed_by and posts.user_id both referenced profiles(id), which made
-- every unqualified `author:profiles(...)` embed ambiguous to PostgREST (it
-- returned 300 Multiple Choices instead of data — silently breaking every
-- post listing, including the home feed). Nothing in the app joins through
-- removed_by, so drop the FK and keep it as a plain audit column.
alter table public.posts drop constraint posts_removed_by_fkey;
