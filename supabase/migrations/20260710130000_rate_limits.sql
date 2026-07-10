-- Rate limits: universal caps on how fast one account can create content.
-- Lives in DB triggers, not the app layer — posts and comments are inserted
-- with the user's own client, so an app-side check could be skipped by
-- calling the API directly. The existing restricted-user limit (3 posts/day,
-- clout v2) still applies on top of these.
--
-- Values are deliberately roomy for honest users and tight for floods:
--   posts:    5 per hour
--   comments: 5 per minute
--   reports: 20 per hour (guard inside file_report)
--
-- NOTE for Dylan: signup throttling and captcha are NOT code — they're
-- Supabase dashboard settings (Auth → Rate limits / Bot protection).

-- ── Posts: 5 per hour ─────────────────────────────────────────────────────────
create or replace function public.trg_post_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.posts
      where user_id = new.user_id
        and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'You''re posting a lot — take a breather and try again in a bit.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_post_rate_limit on public.posts;
create trigger trg_post_rate_limit
before insert on public.posts
for each row execute function public.trg_post_rate_limit();

-- ── Comments: 5 per minute ────────────────────────────────────────────────────
create or replace function public.trg_comment_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.comments
      where user_id = new.user_id
        and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Slow down a moment — you can comment again in a minute.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_comment_rate_limit on public.comments;
create trigger trg_comment_rate_limit
before insert on public.comments
for each row execute function public.trg_comment_rate_limit();

-- ── Reports: 20 per hour, checked inside file_report ─────────────────────────
-- Same function as 20260710120000, with the rate guard added right after the
-- validation block. Everything else is unchanged.
create or replace function public.file_report(
  p_post_id    uuid default null,
  p_comment_id uuid default null,
  p_reason     text default null,
  p_note       text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_id   uuid;
  v_room_id   uuid;
  v_report_id uuid;
  v_owner     uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_reason is null or p_reason not in ('spam','abuse','stolen_work','other') then
    raise exception 'Pick a reason';
  end if;
  if (p_post_id is null) = (p_comment_id is null) then
    raise exception 'Report exactly one post or comment';
  end if;

  -- Rate guard: report-spam is its own kind of abuse
  if (select count(*) from public.reports
      where reporter_id = auth.uid()
        and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'That''s a lot of reports in one hour — take a break and try again later.';
  end if;

  -- Resolve the target down to its post, then the post to its room
  if p_comment_id is not null then
    select post_id into v_post_id from public.comments where id = p_comment_id;
    if v_post_id is null then raise exception 'Comment not found'; end if;
  else
    v_post_id := p_post_id;
  end if;

  select room_id into v_room_id from public.posts where id = v_post_id;
  if not found then raise exception 'Post not found'; end if;

  -- Already an open report from this user on this target? Return it, done.
  select id into v_report_id from public.reports
  where reporter_id = auth.uid()
    and status = 'open'
    and (   (p_post_id    is not null and post_id    = p_post_id)
         or (p_comment_id is not null and comment_id = p_comment_id));
  if v_report_id is not null then
    return v_report_id;
  end if;

  insert into public.reports (post_id, comment_id, room_id, reporter_id, reason, note)
  values (p_post_id, p_comment_id, v_room_id, auth.uid(), p_reason, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_report_id;

  -- Notify whoever can act on it (never the reporter themselves)
  if v_room_id is not null then
    select created_by into v_owner from public.rooms where id = v_room_id;
    if v_owner is not null and v_owner <> auth.uid() then
      insert into public.notifications (user_id, type, post_id)
      values (v_owner, 'report_filed', v_post_id);
    end if;
  else
    insert into public.notifications (user_id, type, post_id)
    select id, 'report_filed', v_post_id
    from public.profiles
    where is_admin and id <> auth.uid();
  end if;

  return v_report_id;
end;
$$;
