-- Salaristoepassing: intersectionsemantiek, strikte bandgrenzen en veilige
-- datumvalidatie voor de logische salarisregel.

alter table public.salary_band_values
  drop constraint if exists salary_band_values_midpoint_amount_check,
  drop constraint if exists salary_band_values_maximum_amount_check;

alter table public.salary_band_values
  add constraint salary_band_values_midpoint_strict
    check (midpoint_amount > minimum_amount),
  add constraint salary_band_values_maximum_strict
    check (maximum_amount is null or maximum_amount > midpoint_amount);

create index if not exists salary_structure_revisions_resolution_idx
  on public.salary_structure_revisions (tenant_id, hr_group_id, salary_structure_id, status, effective_from desc, revision_number desc);

create or replace function internal_security.validate_employment_salary_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  scale_structure_id uuid;
  band_structure_id uuid;
  selected_step_id uuid;
  requested_route public.salary_application_route := new.salary_route;
  labor_condition_has_structure_filter boolean := false;
begin
  if new.salary_basis::text = 'MINIMUM_WAGE' and new.salary_route = 'MANUAL' then
    new.salary_route := 'MINIMUM_WAGE';
    new.minimum_wage_scheme := coalesce(new.minimum_wage_scheme, 'REGULAR'::public.minimum_wage_scheme);
  elsif new.salary_basis::text = 'SALARY_BAND' and new.salary_route = 'MANUAL' then
    new.salary_route := 'SALARY_BAND';
    new.salary_band_id := new.salary_scale_step_id;
  elsif new.salary_basis::text = 'CUSTOM_SCALE' and new.salary_route = 'MANUAL' and new.salary_scale_step_id is not null then
    select step.salary_scale_id, step.step_code, scale.salary_structure_id
    into new.salary_scale_id, new.salary_step_code, new.salary_structure_id
    from public.salary_scale_steps step
    join public.salary_scales scale
      on scale.tenant_id = step.tenant_id
     and scale.hr_group_id = step.hr_group_id
     and scale.id = step.salary_scale_id
    where step.tenant_id = new.tenant_id
      and step.hr_group_id = new.hr_group_id
      and step.id = new.salary_scale_step_id;
    if new.salary_structure_id is not null then new.salary_route := 'SCALE_WITH_STEPS'; end if;
  end if;

  if new.salary_route = 'MINIMUM_WAGE' then
    if new.minimum_wage_scheme is null then
      raise exception 'MINIMUM_WAGE_SCHEME_REQUIRED' using errcode = '23514';
    end if;
    new.salary_structure_id := null;
    new.salary_scale_id := null;
    new.salary_step_code := null;
    new.salary_band_id := null;
    return new;
  end if;

  if new.salary_route = 'SCALE_WITH_STEPS' then
    if new.salary_structure_id is null or new.salary_scale_id is null or new.salary_step_code is null then
      raise exception 'SALARY_SCALE_SELECTION_REQUIRED' using errcode = '23514';
    end if;
    if not exists (
      select 1
      from public.salary_structures structure
      where structure.tenant_id = new.tenant_id
        and structure.hr_group_id = new.hr_group_id
        and structure.id = new.salary_structure_id
        and structure.structure_type = 'SCALE_WITH_STEPS'
        and structure.is_active
    ) then
      raise exception 'SALARY_SCALE_STRUCTURE_NOT_AVAILABLE' using errcode = '23514';
    end if;
    if new.employment_id is not null then
      select exists (
        select 1
        from public.employment_contracts contract
        join public.labor_condition_salary_structures link
          on link.tenant_id = contract.tenant_id
         and link.hr_group_id = contract.hr_group_id
         and link.labor_condition_set_id = contract.labor_condition_set_id
        where contract.tenant_id = new.tenant_id
          and contract.hr_group_id = new.hr_group_id
          and contract.employment_id = new.employment_id
          and link.salary_structure_id is not null
      ) into labor_condition_has_structure_filter;
    end if;
    if requested_route = 'SCALE_WITH_STEPS'
      and new.employment_id is not null
      and labor_condition_has_structure_filter
      and not exists (
        select 1
        from public.employment_contracts contract
        join public.labor_condition_salary_structures link
          on link.tenant_id = contract.tenant_id
         and link.hr_group_id = contract.hr_group_id
         and link.labor_condition_set_id = contract.labor_condition_set_id
         and link.salary_structure_id = new.salary_structure_id
        where contract.tenant_id = new.tenant_id
          and contract.hr_group_id = new.hr_group_id
          and contract.employment_id = new.employment_id
      ) then
      raise exception 'SALARY_STRUCTURE_NOT_AVAILABLE_FOR_LABOR_CONDITION' using errcode = '23514';
    end if;
    select scale.salary_structure_id into scale_structure_id
    from public.salary_scales scale
    where scale.tenant_id = new.tenant_id
      and scale.hr_group_id = new.hr_group_id
      and scale.id = new.salary_scale_id;
    if scale_structure_id is null or scale_structure_id <> new.salary_structure_id then
      raise exception 'SALARY_SCALE_STRUCTURE_MISMATCH' using errcode = '23514';
    end if;
    select step.id into selected_step_id
    from public.salary_scale_steps step
    join public.salary_structure_revisions revision
      on revision.tenant_id = step.tenant_id
     and revision.hr_group_id = step.hr_group_id
     and revision.id = step.salary_structure_revision_id
    where step.tenant_id = new.tenant_id
      and step.hr_group_id = new.hr_group_id
      and step.salary_scale_id = new.salary_scale_id
      and upper(step.step_code) = upper(new.salary_step_code)
      and revision.salary_structure_id = new.salary_structure_id
      and revision.status = 'PUBLISHED'
      and revision.effective_from <= new.valid_from
    order by revision.effective_from desc, revision.revision_number desc
    limit 1;
    if selected_step_id is null then
      raise exception 'SALARY_SCALE_STEP_NOT_VALID' using errcode = '23514';
    end if;
    new.salary_scale_step_id := selected_step_id;
    new.salary_band_id := null;
    return new;
  end if;

  if new.salary_route = 'SALARY_BAND' then
    if new.salary_structure_id is null or new.salary_band_id is null then
      raise exception 'SALARY_BAND_SELECTION_REQUIRED' using errcode = '23514';
    end if;
    select band.salary_structure_id into band_structure_id
    from public.salary_bands band
    where band.tenant_id = new.tenant_id
      and band.hr_group_id = new.hr_group_id
      and band.id = new.salary_band_id;
    if band_structure_id is null or band_structure_id <> new.salary_structure_id then
      raise exception 'SALARY_BAND_STRUCTURE_MISMATCH' using errcode = '23514';
    end if;
    if not exists (
      select 1
      from public.salary_structures structure
      where structure.tenant_id = new.tenant_id
        and structure.hr_group_id = new.hr_group_id
        and structure.id = new.salary_structure_id
        and structure.structure_type = 'SALARY_BAND'
        and structure.is_active
    ) then
      raise exception 'SALARY_BAND_STRUCTURE_NOT_AVAILABLE' using errcode = '23514';
    end if;
    if new.employment_id is not null then
      select exists (
        select 1
        from public.employment_contracts contract
        join public.labor_condition_salary_structures link
          on link.tenant_id = contract.tenant_id
         and link.hr_group_id = contract.hr_group_id
         and link.labor_condition_set_id = contract.labor_condition_set_id
        where contract.tenant_id = new.tenant_id
          and contract.hr_group_id = new.hr_group_id
          and contract.employment_id = new.employment_id
          and link.salary_structure_id is not null
      ) into labor_condition_has_structure_filter;
    end if;
    if requested_route = 'SALARY_BAND'
      and new.employment_id is not null
      and labor_condition_has_structure_filter
      and not exists (
        select 1
        from public.employment_contracts contract
        join public.labor_condition_salary_structures link
          on link.tenant_id = contract.tenant_id
         and link.hr_group_id = contract.hr_group_id
         and link.labor_condition_set_id = contract.labor_condition_set_id
         and link.salary_structure_id = new.salary_structure_id
        where contract.tenant_id = new.tenant_id
          and contract.hr_group_id = new.hr_group_id
          and contract.employment_id = new.employment_id
      ) then
      raise exception 'SALARY_STRUCTURE_NOT_AVAILABLE_FOR_LABOR_CONDITION' using errcode = '23514';
    end if;
    if not exists (
      select 1
      from public.salary_band_values value
      join public.salary_structure_revisions revision
        on revision.tenant_id = value.tenant_id
       and revision.hr_group_id = value.hr_group_id
       and revision.id = value.salary_structure_revision_id
      where value.tenant_id = new.tenant_id
        and value.hr_group_id = new.hr_group_id
        and value.salary_band_id = new.salary_band_id
        and revision.salary_structure_id = new.salary_structure_id
        and revision.status = 'PUBLISHED'
        and revision.effective_from <= new.valid_from
    ) then
      raise exception 'SALARY_BAND_NOT_VALID' using errcode = '23514';
    end if;
    new.salary_scale_id := null;
    new.salary_step_code := null;
    new.salary_scale_step_id := null;
    return new;
  end if;

  new.minimum_wage_scheme := null;
  new.salary_structure_id := null;
  new.salary_scale_id := null;
  new.salary_step_code := null;
  new.salary_band_id := null;
  return new;
end;
$$;

revoke all on function internal_security.validate_employment_salary_application() from public, anon, authenticated;
