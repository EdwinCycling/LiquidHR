begin;

create unique index if not exists leave_profiles_tenant_hr_group_name_ci_key
  on public.leave_profiles (tenant_id, hr_group_id, lower(btrim(name)));

create or replace function internal_security.validate_leave_profile_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.is_group_default and not new.is_active then
    raise exception using errcode = '23514', message = 'LEAVE_PROFILE_DEFAULT_MUST_BE_ACTIVE';
  end if;

  if not new.is_active and exists (
    select 1
    from public.leave_profiles profile
    where profile.tenant_id = new.tenant_id
      and profile.hr_group_id = new.hr_group_id
      and profile.id = new.id
      and profile.is_group_default
  ) then
    raise exception using errcode = '23514', message = 'LEAVE_PROFILE_DEFAULT_REPLACEMENT_REQUIRED';
  end if;

  if not new.is_active and exists (
    select 1
    from public.employee_sets employee_set
    where employee_set.tenant_id = new.tenant_id
      and employee_set.hr_group_id = new.hr_group_id
      and employee_set.leave_profile_id = new.id
      and employee_set.is_active
  ) then
    raise exception using errcode = '23514', message = 'LEAVE_PROFILE_REFERENCED_BY_ACTIVE_SET';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_leave_profile_mutation on public.leave_profiles;
create trigger validate_leave_profile_mutation
before insert or update on public.leave_profiles
for each row execute function internal_security.validate_leave_profile_mutation();

create or replace function public.save_group_leave_profile(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_leave_profile_id uuid,
  requested_name text,
  requested_description text,
  requested_is_active boolean,
  requested_is_group_default boolean
)
returns uuid
language plpgsql
security invoker
set search_path = public, internal_security, auth
as $$
declare
  actor_id uuid := auth.uid();
  profile_id uuid := requested_leave_profile_id;
  existing_profile public.leave_profiles;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'LEAVE_AUTHENTICATION_REQUIRED';
  end if;
  if not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'leave:write') then
    raise exception using errcode = '42501', message = 'LEAVE_PROFILE_WRITE_PERMISSION_REQUIRED';
  end if;
  if requested_name is null or char_length(btrim(requested_name)) not between 1 and 160 then
    raise exception using errcode = '23514', message = 'LEAVE_PROFILE_NAME_REQUIRED';
  end if;
  if requested_description is not null and char_length(requested_description) > 500 then
    raise exception using errcode = '23514', message = 'LEAVE_PROFILE_DESCRIPTION_TOO_LONG';
  end if;
  if requested_is_group_default and not requested_is_active then
    raise exception using errcode = '23514', message = 'LEAVE_PROFILE_DEFAULT_MUST_BE_ACTIVE';
  end if;

  if profile_id is null then
    insert into public.leave_profiles (
      tenant_id, hr_group_id, administration_id, name, description,
      is_active, is_group_default, created_by, updated_by
    ) values (
      requested_tenant_id, requested_hr_group_id, null, btrim(requested_name),
      nullif(btrim(requested_description), ''), requested_is_active, false,
      actor_id, actor_id
    ) returning id into profile_id;
  else
    select * into existing_profile
    from public.leave_profiles profile
    where profile.tenant_id = requested_tenant_id
      and profile.hr_group_id = requested_hr_group_id
      and profile.id = profile_id
    for update;
    if existing_profile.id is null then
      raise exception using errcode = '23503', message = 'LEAVE_PROFILE_NOT_FOUND';
    end if;

    update public.leave_profiles
    set name = btrim(requested_name),
        description = nullif(btrim(requested_description), ''),
        is_active = requested_is_active,
        is_group_default = existing_profile.is_group_default,
        updated_by = actor_id
    where id = profile_id
      and tenant_id = requested_tenant_id
      and hr_group_id = requested_hr_group_id;
  end if;

  if requested_is_group_default then
    update public.leave_profiles
    set is_group_default = false, updated_by = actor_id
    where tenant_id = requested_tenant_id
      and hr_group_id = requested_hr_group_id
      and id <> profile_id
      and is_group_default;

    update public.leave_profiles
    set is_group_default = true, is_active = true, updated_by = actor_id
    where tenant_id = requested_tenant_id
      and hr_group_id = requested_hr_group_id
      and id = profile_id;
  end if;

  return profile_id;
end;
$$;

revoke all on function public.save_group_leave_profile(uuid, uuid, uuid, text, text, boolean, boolean) from public, anon;
grant execute on function public.save_group_leave_profile(uuid, uuid, uuid, text, text, boolean, boolean) to authenticated;

-- An archived profile must never remain the active employee-set result.
create or replace function public.resolve_leave_profile_for_employment(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employment_id uuid,
  requested_as_of_date date
)
returns uuid
language plpgsql
stable
security definer
set search_path = public, internal_security, auth
as $$
declare
  resolved_profile_id uuid;
  target_employee_id uuid;
begin
  select employment.employee_id into target_employee_id
  from public.employments employment
  where employment.tenant_id = requested_tenant_id
    and employment.hr_group_id = requested_hr_group_id
    and employment.id = requested_employment_id
    and employment.record_status = 'CONFIRMED'
    and employment.deleted_at is null;
  if target_employee_id is null then
    raise exception using errcode = '23503', message = 'LEAVE_EMPLOYMENT_NOT_FOUND';
  end if;

  select assignment.leave_profile_id into resolved_profile_id
  from public.employment_leave_profiles assignment
  join public.leave_profiles profile
    on profile.tenant_id = assignment.tenant_id
   and profile.hr_group_id = assignment.hr_group_id
   and profile.id = assignment.leave_profile_id
   and profile.is_active
  where assignment.tenant_id = requested_tenant_id
    and assignment.hr_group_id = requested_hr_group_id
    and assignment.employment_id = requested_employment_id
    and assignment.valid_from <= requested_as_of_date
    and (assignment.valid_until is null or assignment.valid_until > requested_as_of_date)
  order by assignment.valid_from desc
  limit 1;

  if resolved_profile_id is null then
    select employee_set.leave_profile_id into resolved_profile_id
    from public.employee_set_members member
    join public.employee_sets employee_set
      on employee_set.tenant_id = member.tenant_id
     and employee_set.hr_group_id = member.hr_group_id
     and employee_set.id = member.employee_set_id
     and employee_set.is_active
    join public.leave_profiles profile
      on profile.tenant_id = employee_set.tenant_id
     and profile.hr_group_id = employee_set.hr_group_id
     and profile.id = employee_set.leave_profile_id
     and profile.is_active
    where member.tenant_id = requested_tenant_id
      and member.hr_group_id = requested_hr_group_id
      and member.employee_id = target_employee_id
      and member.valid_from <= requested_as_of_date
      and (member.valid_until is null or member.valid_until > requested_as_of_date)
    order by employee_set.priority, employee_set.name, employee_set.id
    limit 1;
  end if;

  if resolved_profile_id is null then
    select profile.id into resolved_profile_id
    from public.leave_profiles profile
    where profile.tenant_id = requested_tenant_id
      and profile.hr_group_id = requested_hr_group_id
      and profile.is_active
      and profile.is_group_default
    limit 1;
  end if;
  return resolved_profile_id;
end;
$$;

revoke all on function public.resolve_leave_profile_for_employment(uuid, uuid, uuid, date) from public, anon;
grant execute on function public.resolve_leave_profile_for_employment(uuid, uuid, uuid, date) to authenticated;

commit;
