begin;

-- Een nog niet gepubliceerde ronde blijft CONCEPT, ook als de startdatum
-- in de toekomst ligt. Publiceren zet de ronde op GEPLAND of ACTIEF.
create or replace function public.create_performance_review_round(
  requested_hr_group uuid,
  requested_title text,
  requested_introduction text,
  requested_period_start date,
  requested_period_end date,
  requested_start_date date,
  requested_due_date date,
  requested_rating_snapshot jsonb,
  requested_idempotency_key text default null,
  requested_round_type text default 'DEVELOPMENT'
) returns public.performance_review_rounds
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare result_row public.performance_review_rounds; tenant_value uuid; previous_id uuid; request_hash text;
begin
  if auth.uid() is null then raise exception 'PERFORMANCE_AUTH_REQUIRED'; end if;
  select tenant_id into tenant_value from public.hr_groups where id = requested_hr_group and is_active;
  request_hash := md5(concat_ws('|', requested_hr_group::text, requested_title, requested_introduction, requested_period_start::text, requested_period_end::text, requested_start_date::text, requested_due_date::text, requested_rating_snapshot::text, requested_round_type));
  if requested_idempotency_key is not null then
    perform internal_security.performance_review_lock_idempotency('ROUND_CREATED', requested_idempotency_key);
    previous_id := internal_security.performance_review_previous_result(tenant_value, 'ROUND_CREATED', requested_idempotency_key, request_hash);
    if previous_id is not null then select * into result_row from public.performance_review_rounds where id = previous_id; return result_row; end if;
  end if;
  if not internal_security.performance_review_can_manage(tenant_value, requested_hr_group) then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  if requested_period_end < requested_period_start then raise exception 'PERFORMANCE_PERIOD_INVALID'; end if;
  if not internal_security.performance_review_valid_rating_snapshot(requested_rating_snapshot) then raise exception 'PERFORMANCE_RATING_INVALID'; end if;
  if length(btrim(coalesce(requested_round_type, ''))) not between 1 and 80 then raise exception 'PERFORMANCE_ROUND_TYPE_INVALID'; end if;
  insert into public.performance_review_rounds (tenant_id, hr_group_id, title, round_type, introduction, period_start, period_end, start_date, due_date, rating_snapshot, status, created_by)
  select tenant_id, requested_hr_group, btrim(requested_title), btrim(requested_round_type), btrim(requested_introduction), requested_period_start, requested_period_end, requested_start_date, requested_due_date, requested_rating_snapshot, 'DRAFT', auth.uid()
  from public.hr_groups where id = requested_hr_group and is_active returning * into result_row;
  if result_row.id is null then raise exception 'PERFORMANCE_HR_GROUP_NOT_FOUND'; end if;
  if requested_idempotency_key is not null then insert into public.performance_review_command_results (tenant_id, actor_user_id, operation, idempotency_key, request_hash, result_id, result_version) values (result_row.tenant_id, auth.uid(), 'ROUND_CREATED', requested_idempotency_key, request_hash, result_row.id, result_row.version) on conflict do nothing; end if;
  insert into public.performance_review_audit_events (tenant_id, round_id, action) values (result_row.tenant_id, result_row.id, 'ROUND_CREATED');
  return result_row;
end;
$$;

revoke all on function public.create_performance_review_round(uuid, text, text, date, date, date, date, jsonb, text, text) from public, anon;
grant execute on function public.create_performance_review_round(uuid, text, text, date, date, date, date, jsonb, text, text) to authenticated;

commit;
