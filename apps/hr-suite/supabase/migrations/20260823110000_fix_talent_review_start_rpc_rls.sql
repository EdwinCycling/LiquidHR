-- Assignment materialization is an internal campaign command. It must be able
-- to insert the immutable assignment snapshots while callers remain unable to
-- insert those rows directly.
alter function public.start_talent_review_campaign(uuid) security definer;
alter function public.start_talent_review_campaign(uuid)
  set search_path = public, internal_security, auth, pg_temp;
