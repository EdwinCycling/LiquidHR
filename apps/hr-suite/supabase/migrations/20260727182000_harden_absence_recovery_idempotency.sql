create or replace function internal_security.recover_absence(
  requested_case_id uuid,
  requested_recovered_on date,
  requested_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
declare
  case_record public.absence_cases%rowtype;
  existing_mutation uuid;
begin
  select * into case_record
  from public.absence_cases
  where id = requested_case_id
  for update;

  if case_record.id is null or not internal_security.can_manage_employee(case_record.employee_id, 'absence:recover') then
    raise exception 'ABSENCE_FORBIDDEN' using errcode = '42501';
  end if;

  if requested_idempotency_key is not null then
    select result_case_id into existing_mutation
    from public.absence_mutations
    where tenant_id = case_record.tenant_id
      and operation_key = requested_idempotency_key;
    if existing_mutation is not null then
      return existing_mutation;
    end if;
  end if;

  update public.absence_spells
  set recovered_on = requested_recovered_on,
      recovered_at = timezone('utc', now()),
      recovered_by_user_id = auth.uid()
  where case_id = requested_case_id
    and recovered_on is null;

  if not found then
    raise exception 'ABSENCE_NO_OPEN_SPELL' using errcode = '23514';
  end if;

  update public.absence_cases
  set status = 'RECOVERY_WINDOW',
      recovery_window_ends_on = requested_recovered_on + 28,
      updated_at = timezone('utc', now())
  where id = requested_case_id;

  if requested_idempotency_key is not null then
    insert into public.absence_mutations (tenant_id, operation_key, operation_type, result_case_id)
    values (case_record.tenant_id, requested_idempotency_key, 'RECOVER', requested_case_id)
    on conflict do nothing;
  end if;

  return requested_case_id;
end;
$$;

revoke all on function internal_security.recover_absence(uuid, date, text) from public, anon;
grant execute on function internal_security.recover_absence(uuid, date, text) to authenticated;
