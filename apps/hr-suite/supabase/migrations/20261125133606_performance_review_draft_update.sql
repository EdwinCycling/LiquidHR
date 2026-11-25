begin;

alter table public.performance_review_audit_events
  drop constraint performance_review_audit_events_action_check;

alter table public.performance_review_audit_events
  add constraint performance_review_audit_events_action_check check (action in (
    'ROUND_CREATED', 'ROUND_DRAFT_UPDATED', 'ROUND_PUBLISHED', 'ROUND_ACTIVATED', 'ROUND_CANCELLED',
    'DOSSIER_CREATED', 'REVIEWER_REASSIGNED', 'SELF_SAVED', 'SELF_SUBMITTED', 'MANAGER_SAVED',
    'MANAGER_SUBMITTED', 'ACKNOWLEDGED', 'PRIVATE_NOTE_SAVED', 'ATTACHMENT_ADDED',
    'ATTACHMENT_REMOVED', 'APPRAISAL_LINKED', 'ROUND_CLOSED'
  ));

create or replace function public.update_performance_review_round(
  requested_round uuid,
  requested_title text,
  requested_introduction text,
  requested_round_type text,
  requested_period_start date,
  requested_period_end date,
  requested_start_date date,
  requested_due_date date,
  requested_rating_snapshot jsonb,
  expected_version integer
) returns public.performance_review_rounds
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare result_row public.performance_review_rounds;
begin
  select * into result_row
  from public.performance_review_rounds
  where id = requested_round
  for update;

  if result_row.id is null then raise exception 'PERFORMANCE_NOT_FOUND'; end if;
  if not internal_security.performance_review_can_manage(result_row.tenant_id, result_row.hr_group_id) then
    raise exception 'PERFORMANCE_FORBIDDEN';
  end if;
  if result_row.status <> 'DRAFT' or result_row.version <> expected_version then
    raise exception 'PERFORMANCE_VERSION_OR_PHASE_CONFLICT';
  end if;
  if length(btrim(coalesce(requested_title, ''))) not between 1 and 160 then
    raise exception 'PERFORMANCE_TITLE_INVALID';
  end if;
  if length(btrim(coalesce(requested_introduction, ''))) = 0 then
    raise exception 'PERFORMANCE_INTRODUCTION_REQUIRED';
  end if;
  if length(btrim(coalesce(requested_round_type, ''))) not between 1 and 80 then
    raise exception 'PERFORMANCE_ROUND_TYPE_INVALID';
  end if;
  if requested_period_end < requested_period_start then
    raise exception 'PERFORMANCE_PERIOD_INVALID';
  end if;
  if requested_due_date is not null and requested_due_date < requested_start_date then
    raise exception 'PERFORMANCE_DUE_DATE_INVALID';
  end if;
  if not internal_security.performance_review_valid_rating_snapshot(requested_rating_snapshot) then
    raise exception 'PERFORMANCE_RATING_INVALID';
  end if;

  update public.performance_review_rounds
  set title = btrim(requested_title),
      introduction = btrim(requested_introduction),
      round_type = btrim(requested_round_type),
      period_start = requested_period_start,
      period_end = requested_period_end,
      start_date = requested_start_date,
      due_date = requested_due_date,
      rating_snapshot = requested_rating_snapshot,
      version = version + 1
  where id = requested_round and status = 'DRAFT' and version = expected_version
  returning * into result_row;

  if result_row.id is null then raise exception 'PERFORMANCE_VERSION_OR_PHASE_CONFLICT'; end if;
  insert into public.performance_review_audit_events (tenant_id, round_id, action)
  values (result_row.tenant_id, result_row.id, 'ROUND_DRAFT_UPDATED');
  return result_row;
end;
$$;

revoke all on function public.update_performance_review_round(uuid, text, text, text, date, date, date, date, jsonb, integer) from public, anon;
grant execute on function public.update_performance_review_round(uuid, text, text, text, date, date, date, date, jsonb, integer) to authenticated;

commit;
