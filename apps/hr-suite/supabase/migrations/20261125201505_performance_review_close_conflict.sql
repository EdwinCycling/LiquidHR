-- Scheid autorisatie van versieconflicten en serialiseer gelijktijdige sluitingen.
create or replace function public.close_performance_review_round(
  requested_round uuid,
  requested_reason text,
  expected_version integer,
  requested_idempotency_key text default null
)
returns public.performance_review_rounds
language plpgsql
security definer
set search_path = public, internal_security, auth, pg_temp
as $$
declare
  result_row public.performance_review_rounds;
  previous_id uuid;
  request_hash text;
begin
  if length(btrim(requested_reason)) = 0 then
    raise exception 'PERFORMANCE_CLOSE_REASON_REQUIRED';
  end if;

  -- De rijlock maakt verschillende gelijktijdige sluitverzoeken deterministisch.
  select * into result_row
  from public.performance_review_rounds
  where id = requested_round
  for update;

  if result_row.id is null then
    raise exception 'PERFORMANCE_NOT_FOUND';
  end if;
  if not internal_security.performance_review_can_manage(result_row.tenant_id, result_row.hr_group_id) then
    raise exception 'PERFORMANCE_FORBIDDEN';
  end if;

  request_hash := md5(concat_ws('|', requested_round::text, requested_reason, expected_version::text));
  if requested_idempotency_key is not null then
    perform internal_security.performance_review_lock_idempotency('ROUND_CLOSED', requested_idempotency_key);
    previous_id := internal_security.performance_review_previous_result(
      result_row.tenant_id,
      'ROUND_CLOSED',
      requested_idempotency_key,
      request_hash
    );
    if previous_id is not null then
      select * into result_row
      from public.performance_review_rounds
      where id = previous_id;
      return result_row;
    end if;
  end if;

  if result_row.version <> expected_version or result_row.status not in ('DRAFT', 'SCHEDULED', 'ACTIVE') then
    raise exception 'PERFORMANCE_ROUND_CONFLICT';
  end if;

  update public.performance_review_rounds
  set status = 'CLOSED', version = version + 1
  where id = requested_round and version = expected_version
  returning * into result_row;

  if result_row.id is null then
    raise exception 'PERFORMANCE_ROUND_CONFLICT';
  end if;

  if requested_idempotency_key is not null then
    insert into public.performance_review_command_results
      (tenant_id, actor_user_id, operation, idempotency_key, request_hash, result_id, result_version)
    values
      (result_row.tenant_id, auth.uid(), 'ROUND_CLOSED', requested_idempotency_key, request_hash, result_row.id, result_row.version)
    on conflict do nothing;
  end if;

  insert into public.performance_review_audit_events (tenant_id, round_id, action, reason)
  values (result_row.tenant_id, result_row.id, 'ROUND_CLOSED', btrim(requested_reason));

  return result_row;
end;
$$;
