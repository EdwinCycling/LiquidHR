-- Supabase marks NOT NULL columns without a concrete default as required in
-- generated inserts. A sentinel default preserves existing callers; the BEFORE
-- trigger replaces it with the employment's authoritative HR group.
alter table public.employment_salaries
  alter column hr_group_id set default '00000000-0000-0000-0000-000000000000'::uuid;

create or replace function internal_security.populate_employment_salary_hr_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_hr_group_id uuid;
begin
  select employment.hr_group_id into expected_hr_group_id
  from public.employments employment
  where employment.tenant_id = new.tenant_id
    and employment.id = new.employment_id;
  if expected_hr_group_id is null then
    raise exception 'EMPLOYMENT_HR_GROUP_NOT_FOUND' using errcode = '23503';
  end if;
  if new.hr_group_id is not null
     and new.hr_group_id <> '00000000-0000-0000-0000-000000000000'::uuid
     and new.hr_group_id <> expected_hr_group_id then
    raise exception 'EMPLOYMENT_SALARY_HR_GROUP_MISMATCH' using errcode = '23514';
  end if;
  new.hr_group_id := expected_hr_group_id;
  return new;
end;
$$;

revoke all on function internal_security.populate_employment_salary_hr_group() from public, anon, authenticated;
