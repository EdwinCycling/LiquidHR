-- Salaristoepassing: één route-model bovenop de bestaande employment_salaries-timeline.
-- De bestaande salary- en salary-structures-architectuur blijft de bron voor historie,
-- revisies en toegangscontrole.

create type public.salary_application_route as enum (
  'MANUAL',
  'MINIMUM_WAGE',
  'SCALE_WITH_STEPS',
  'SALARY_BAND'
);

create type public.minimum_wage_scheme as enum ('REGULAR', 'BBL');

-- De oude complete-employment RPC gebruikt salary_basis als compatibiliteits-
-- payload. De nieuwe salary_route blijft de domeinbron; SALARY_BAND is alleen
-- de migratiebrug voor bestaande RPC-aanroepen.
alter type public.salary_basis add value if not exists 'SALARY_BAND';

alter table public.administration_hr_settings
  add column salary_routes public.salary_application_route[] not null
    default array[
      'MANUAL'::public.salary_application_route,
      'MINIMUM_WAGE'::public.salary_application_route
    ],
  add column salary_structure_ids uuid[] not null default '{}'::uuid[];

-- Bestaande organisaties behouden hun huidige handmatige/minimumloon-keuze.
-- Gemigreerde HR-groepstructuren worden beschikbaar gemaakt zonder historische
-- employment_salaries te wijzigen.
update public.administration_hr_settings settings
set
  salary_routes = case
    when exists (
      select 1 from public.salary_structures structure
      join public.administrations administration
        on administration.tenant_id = settings.tenant_id
       and administration.id = settings.administration_id
       and administration.hr_group_id = structure.hr_group_id
      where structure.tenant_id = settings.tenant_id
        and structure.structure_type = 'SCALE_WITH_STEPS'
        and structure.is_active
    ) and exists (
      select 1 from public.salary_structures structure
      join public.administrations administration
        on administration.tenant_id = settings.tenant_id
       and administration.id = settings.administration_id
       and administration.hr_group_id = structure.hr_group_id
      where structure.tenant_id = settings.tenant_id
        and structure.structure_type = 'SALARY_BAND'
        and structure.is_active
    ) then array[
      'MANUAL'::public.salary_application_route,
      'MINIMUM_WAGE'::public.salary_application_route,
      'SCALE_WITH_STEPS'::public.salary_application_route,
      'SALARY_BAND'::public.salary_application_route
    ]
    when exists (
      select 1 from public.salary_structures structure
      join public.administrations administration
        on administration.tenant_id = settings.tenant_id
       and administration.id = settings.administration_id
       and administration.hr_group_id = structure.hr_group_id
      where structure.tenant_id = settings.tenant_id
        and structure.structure_type = 'SCALE_WITH_STEPS'
        and structure.is_active
    ) then array[
      'MANUAL'::public.salary_application_route,
      'MINIMUM_WAGE'::public.salary_application_route,
      'SCALE_WITH_STEPS'::public.salary_application_route
    ]
    when exists (
      select 1 from public.salary_structures structure
      join public.administrations administration
        on administration.tenant_id = settings.tenant_id
       and administration.id = settings.administration_id
       and administration.hr_group_id = structure.hr_group_id
      where structure.tenant_id = settings.tenant_id
        and structure.structure_type = 'SALARY_BAND'
        and structure.is_active
    ) then array[
      'MANUAL'::public.salary_application_route,
      'MINIMUM_WAGE'::public.salary_application_route,
      'SALARY_BAND'::public.salary_application_route
    ]
    else array[
      'MANUAL'::public.salary_application_route,
      'MINIMUM_WAGE'::public.salary_application_route
    ]
  end,
  salary_structure_ids = coalesce((
    select array_agg(structure.id order by structure.name)
    from public.salary_structures structure
    join public.administrations administration
      on administration.tenant_id = settings.tenant_id
     and administration.id = settings.administration_id
     and administration.hr_group_id = structure.hr_group_id
    where structure.tenant_id = settings.tenant_id
      and structure.is_active
  ), '{}'::uuid[]);

create policy administration_hr_settings_salary_read
on public.administration_hr_settings for select to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'salary:read'
)));

create policy administration_hr_settings_salary_update
on public.administration_hr_settings for update to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'salary:write'
)))
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'salary:write'
)));

alter table public.employment_salaries
  add column salary_route public.salary_application_route not null default 'MANUAL',
  add column minimum_wage_scheme public.minimum_wage_scheme,
  add column salary_structure_id uuid,
  add column salary_scale_id uuid,
  add column salary_step_code text,
  add column salary_band_id uuid;

update public.employment_salaries salary
set salary_route = case
  when salary.salary_basis = 'MINIMUM_WAGE' then 'MINIMUM_WAGE'::public.salary_application_route
  when salary.salary_basis = 'CUSTOM_SCALE' and salary.salary_scale_step_id is not null then 'SCALE_WITH_STEPS'::public.salary_application_route
  else 'MANUAL'::public.salary_application_route
end,
minimum_wage_scheme = case
  when salary.salary_basis = 'MINIMUM_WAGE' then 'REGULAR'::public.minimum_wage_scheme
  else null
end;

update public.employment_salaries salary
set
  salary_structure_id = structure.id,
  salary_scale_id = scale.id,
  salary_step_code = step.step_code
from public.salary_scale_steps step
join public.salary_scales scale
  on scale.tenant_id = step.tenant_id
 and scale.hr_group_id = step.hr_group_id
 and scale.id = step.salary_scale_id
join public.salary_structure_revisions revision
  on revision.tenant_id = step.tenant_id
 and revision.hr_group_id = step.hr_group_id
 and revision.id = step.salary_structure_revision_id
join public.salary_structures structure
  on structure.tenant_id = revision.tenant_id
 and structure.hr_group_id = revision.hr_group_id
 and structure.id = revision.salary_structure_id
where salary.salary_scale_step_id = step.id
  and salary.salary_route = 'SCALE_WITH_STEPS';

alter table public.employment_salaries
  add constraint employment_salaries_structure_fkey
    foreign key (tenant_id, hr_group_id, salary_structure_id)
    references public.salary_structures(tenant_id, hr_group_id, id) on delete restrict,
  add constraint employment_salaries_scale_fkey
    foreign key (tenant_id, hr_group_id, salary_scale_id)
    references public.salary_scales(tenant_id, hr_group_id, id) on delete restrict,
  add constraint employment_salaries_band_fkey
    foreign key (tenant_id, hr_group_id, salary_band_id)
    references public.salary_bands(tenant_id, hr_group_id, id) on delete restrict;

alter table public.employment_salaries
  drop constraint if exists employment_salaries_amounts_valid;

alter table public.employment_salaries
  add constraint employment_salaries_amounts_valid check (
    coalesce(fulltime_amount, 0) >= 0 and coalesce(hourly_rate, 0) >= 0
    and (
      salary_route = 'MINIMUM_WAGE'
      or (payment_type <> 'PERIODIC_FIXED' or fulltime_amount is not null)
    )
    and (
      salary_route = 'MINIMUM_WAGE'
      or (payment_type <> 'HOURLY_VARIABLE' or hourly_rate is not null)
    )
    and (
      salary_basis <> 'CUSTOM_SCALE'
      or salary_route = 'SCALE_WITH_STEPS'
      or salary_scale_step_id is not null
    )
    and (salary_basis <> 'CAO_SCALE' or (cao_scale_name is not null and cao_step_name is not null))
    and (salary_route <> 'MINIMUM_WAGE' or minimum_wage_scheme is not null)
    and (
      salary_route <> 'SCALE_WITH_STEPS'
      or (
        salary_structure_id is not null
        and salary_scale_id is not null
        and salary_step_code is not null
        and fulltime_amount is not null
      )
    )
    and (
      salary_route <> 'SALARY_BAND'
      or (
        salary_structure_id is not null
        and salary_band_id is not null
        and fulltime_amount is not null
      )
    )
  );

create index employment_salaries_salary_route_idx
  on public.employment_salaries (tenant_id, hr_group_id, salary_route, valid_from desc);
create index employment_salaries_salary_structure_idx
  on public.employment_salaries (tenant_id, hr_group_id, salary_structure_id)
  where salary_structure_id is not null;

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
    if requested_route = 'SCALE_WITH_STEPS' and new.employment_id is not null and not exists (
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
    if requested_route = 'SALARY_BAND' and new.employment_id is not null and not exists (
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
drop trigger if exists validate_employment_salary_application on public.employment_salaries;
create trigger validate_employment_salary_application
before insert or update of salary_basis, salary_scale_step_id, salary_route,
  minimum_wage_scheme, salary_structure_id, salary_scale_id, salary_step_code,
  salary_band_id, valid_from
on public.employment_salaries
for each row execute function internal_security.validate_employment_salary_application();

create or replace function public.save_administration_salary_settings(
  requested_administration_id uuid,
  requested_routes public.salary_application_route[],
  requested_structure_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  administration public.administrations%rowtype;
  settings public.administration_hr_settings%rowtype;
  distinct_structure_count integer;
  valid_structure_count integer;
  scale_structure_count integer;
  band_structure_count integer;
begin
  select * into administration
  from public.administrations
  where id = requested_administration_id and is_active;
  if administration.id is null then raise exception 'ADMINISTRATION_NOT_FOUND'; end if;
  if not internal_security.current_user_has_permission(
    administration.tenant_id, administration.id, 'salary:write'
  ) then raise exception 'FORBIDDEN'; end if;
  if requested_routes is null or cardinality(requested_routes) = 0 then
    raise exception 'SALARY_ROUTE_REQUIRED';
  end if;
  if not ('MANUAL'::public.salary_application_route = any(requested_routes)) then
    raise exception 'MANUAL_ROUTE_REQUIRED';
  end if;
  select count(distinct item.structure_id), count(*)
  into distinct_structure_count, valid_structure_count
  from unnest(coalesce(requested_structure_ids, '{}'::uuid[])) as item(structure_id);
  if distinct_structure_count <> valid_structure_count then
    raise exception 'SALARY_STRUCTURE_DUPLICATE';
  end if;
  select count(*) into valid_structure_count
  from public.salary_structures structure
  where structure.tenant_id = administration.tenant_id
    and structure.hr_group_id = administration.hr_group_id
    and structure.is_active
    and structure.id = any(coalesce(requested_structure_ids, '{}'::uuid[]));
  if valid_structure_count <> cardinality(coalesce(requested_structure_ids, '{}'::uuid[])) then
    raise exception 'SALARY_STRUCTURE_NOT_AVAILABLE';
  end if;
  select count(*) into scale_structure_count
  from public.salary_structures structure
  where structure.tenant_id = administration.tenant_id
    and structure.hr_group_id = administration.hr_group_id
    and structure.structure_type = 'SCALE_WITH_STEPS'
    and structure.is_active
    and structure.id = any(coalesce(requested_structure_ids, '{}'::uuid[]));
  select count(*) into band_structure_count
  from public.salary_structures structure
  where structure.tenant_id = administration.tenant_id
    and structure.hr_group_id = administration.hr_group_id
    and structure.structure_type = 'SALARY_BAND'
    and structure.is_active
    and structure.id = any(coalesce(requested_structure_ids, '{}'::uuid[]));
  if 'SCALE_WITH_STEPS'::public.salary_application_route = any(requested_routes)
    and scale_structure_count = 0 then
    raise exception 'SALARY_SCALE_STRUCTURE_REQUIRED';
  end if;
  if 'SALARY_BAND'::public.salary_application_route = any(requested_routes)
    and band_structure_count = 0 then
    raise exception 'SALARY_BAND_STRUCTURE_REQUIRED';
  end if;

  update public.administration_hr_settings
  set salary_routes = requested_routes,
      salary_structure_ids = coalesce(requested_structure_ids, '{}'::uuid[])
  where tenant_id = administration.tenant_id
    and administration_id = administration.id
  returning * into settings;
  if settings.id is null then raise exception 'EMPLOYMENT_SETTINGS_NOT_FOUND'; end if;
  return jsonb_build_object(
    'administrationId', settings.administration_id,
    'salaryRoutes', settings.salary_routes,
    'salaryStructureIds', settings.salary_structure_ids
  );
end;
$$;

create or replace function public.apply_salary_application_change(
  requested_employment_id uuid,
  requested_effective_on date,
  requested_payload jsonb,
  requested_reason text,
  requested_warning_codes text[] default '{}',
  requested_acknowledgements jsonb default '{}'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  employment public.employments%rowtype;
  change_id uuid;
  salary_id uuid;
  next_date date;
  route public.salary_application_route;
  scheme public.minimum_wage_scheme;
  selected_structure_id uuid;
  selected_scale_id uuid;
  selected_band_id uuid;
  settings public.administration_hr_settings%rowtype;
begin
  select * into employment
  from public.employments
  where id = requested_employment_id and deleted_at is null
  for update;
  if employment.id is null then raise exception 'EMPLOYMENT_NOT_FOUND'; end if;
  if requested_effective_on < employment.starts_on
     or (employment.ends_on is not null and requested_effective_on > employment.ends_on) then
    raise exception 'TIMELINE_DATE_OUTSIDE_EMPLOYMENT';
  end if;
  if not internal_security.current_user_has_permission(
    employment.tenant_id, employment.administration_id, 'salary:write'
  ) then raise exception 'FORBIDDEN'; end if;
  route := (requested_payload ->> 'salaryRoute')::public.salary_application_route;
  if route is null then raise exception 'SALARY_ROUTE_REQUIRED'; end if;
  select * into settings
  from public.administration_hr_settings
  where tenant_id = employment.tenant_id
    and administration_id = employment.administration_id;
  if settings.id is null or not route = any(settings.salary_routes) then
    raise exception 'SALARY_ROUTE_DISABLED';
  end if;

  selected_structure_id := nullif(requested_payload ->> 'salaryStructureId', '')::uuid;
  selected_scale_id := nullif(requested_payload ->> 'salaryScaleId', '')::uuid;
  selected_band_id := nullif(requested_payload ->> 'salaryBandId', '')::uuid;
  if selected_structure_id is not null
    and not selected_structure_id = any(settings.salary_structure_ids) then
    raise exception 'SALARY_STRUCTURE_NOT_AVAILABLE';
  end if;
  if route = 'SCALE_WITH_STEPS' and selected_structure_id is null then
    raise exception 'SALARY_SCALE_SELECTION_REQUIRED';
  end if;
  if route = 'SCALE_WITH_STEPS' and selected_scale_id is null then
    raise exception 'SALARY_SCALE_SELECTION_REQUIRED';
  end if;
  if route = 'SCALE_WITH_STEPS' and nullif(requested_payload ->> 'salaryStepCode', '') is null then
    raise exception 'SALARY_SCALE_SELECTION_REQUIRED';
  end if;
  if route = 'SCALE_WITH_STEPS' and not exists (
    select 1 from public.salary_structures structure
    where structure.tenant_id = employment.tenant_id
      and structure.hr_group_id = employment.hr_group_id
      and structure.id = selected_structure_id
      and structure.structure_type = 'SCALE_WITH_STEPS'
      and structure.is_active
  ) then
    raise exception 'SALARY_SCALE_STRUCTURE_NOT_AVAILABLE';
  end if;
  if route = 'SALARY_BAND' and selected_band_id is null then
    raise exception 'SALARY_BAND_SELECTION_REQUIRED';
  end if;
  if route = 'SALARY_BAND' and selected_structure_id is null then
    raise exception 'SALARY_BAND_SELECTION_REQUIRED';
  end if;
  if route = 'SALARY_BAND' and not exists (
    select 1 from public.salary_structures structure
    where structure.tenant_id = employment.tenant_id
      and structure.hr_group_id = employment.hr_group_id
      and structure.id = selected_structure_id
      and structure.structure_type = 'SALARY_BAND'
      and structure.is_active
  ) then
    raise exception 'SALARY_BAND_STRUCTURE_NOT_AVAILABLE';
  end if;
  if route = 'MINIMUM_WAGE' then
    scheme := (requested_payload ->> 'minimumWageScheme')::public.minimum_wage_scheme;
    if scheme is null then raise exception 'MINIMUM_WAGE_SCHEME_REQUIRED'; end if;
  end if;
  if exists (
    select 1 from public.employment_salaries
    where employment_id = employment.id and valid_from = requested_effective_on
  ) then raise exception 'TIMELINE_EFFECTIVE_DATE_CONFLICT'; end if;

  select min(valid_from) into next_date
  from public.employment_salaries
  where employment_id = employment.id and valid_from > requested_effective_on;
  update public.employment_salaries
  set valid_until = requested_effective_on
  where employment_id = employment.id
    and valid_from < requested_effective_on
    and (valid_until is null or valid_until > requested_effective_on);

  insert into public.employment_change_sets (
    tenant_id, administration_id, employee_id, employment_id, effective_on,
    reason, domains, warning_codes, acknowledgements
  ) values (
    employment.tenant_id, employment.administration_id, employment.employee_id,
    employment.id, requested_effective_on, requested_reason, array['SALARY'],
    requested_warning_codes, requested_acknowledgements
  ) returning id into change_id;
  perform set_config('app.change_set_id', change_id::text, true);

  insert into public.employment_salaries (
    tenant_id, administration_id, employee_id, employment_id,
    payment_type, payment_frequency, salary_basis, fulltime_amount,
    parttime_amount, hourly_rate, currency_code, salary_scale_step_id,
    cao_scale_name, cao_step_name, salary_route, minimum_wage_scheme,
    salary_structure_id, salary_scale_id, salary_step_code, salary_band_id,
    valid_from, valid_until, change_set_id
  ) values (
    employment.tenant_id, employment.administration_id, employment.employee_id,
    employment.id,
    coalesce((requested_payload ->> 'paymentType')::public.salary_payment_type, 'PERIODIC_FIXED'),
    (requested_payload ->> 'paymentFrequency')::public.salary_frequency,
    case route
      when 'SCALE_WITH_STEPS' then 'CUSTOM_SCALE'::public.salary_basis
      when 'MINIMUM_WAGE' then 'MINIMUM_WAGE'::public.salary_basis
      else 'MANUAL'::public.salary_basis
    end,
    nullif(requested_payload ->> 'fulltimeAmount', '')::numeric,
    nullif(requested_payload ->> 'parttimeAmount', '')::numeric,
    nullif(requested_payload ->> 'hourlyRate', '')::numeric,
    coalesce(requested_payload ->> 'currencyCode', 'EUR'),
    nullif(requested_payload ->> 'salaryScaleStepId', '')::uuid,
    nullif(requested_payload ->> 'caoScaleName', ''),
    nullif(requested_payload ->> 'caoStepName', ''),
    route,
    scheme,
    selected_structure_id,
    selected_scale_id,
    nullif(requested_payload ->> 'salaryStepCode', ''),
    selected_band_id,
    requested_effective_on,
    next_date,
    change_id
  ) returning id into salary_id;

  update public.employment_change_sets
  set status = 'APPLIED', applied_at = timezone('utc', now())
  where id = change_id;
  return jsonb_build_object('changeSetId', change_id, 'salaryId', salary_id);
end;
$$;

-- De gecombineerde uren/rooster/salaris-flow gebruikt dezelfde routevalidatie
-- als de losse salaris-mutatie. Legacy payloads blijven via de eerdere functie
-- compatibel; nieuwe payloads met salaryRoute komen hier terecht.
create or replace function public.apply_combined_salary_application_change(
  requested_employment_id uuid,
  requested_effective_on date,
  requested_mutations jsonb,
  requested_reason text,
  requested_warning_codes text[] default '{}',
  requested_acknowledgements jsonb default '{}'
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  employment public.employments%rowtype;
  change_id uuid;
  mutation jsonb;
  requested_timeline text;
  requested_payload jsonb;
  requested_domains text[];
  next_date date;
  allocation_count integer;
  allocation_total numeric;
  allocation jsonb;
  route public.salary_application_route;
  scheme public.minimum_wage_scheme;
  selected_structure_id uuid;
  selected_scale_id uuid;
  selected_band_id uuid;
  settings public.administration_hr_settings%rowtype;
begin
  if jsonb_typeof(requested_mutations) <> 'array' or jsonb_array_length(requested_mutations) < 2 then
    raise exception 'COMBINED_TIMELINE_MINIMUM_REQUIRED';
  end if;
  if jsonb_typeof(requested_acknowledgements) <> 'object' then
    raise exception 'ACKNOWLEDGEMENTS_INVALID';
  end if;

  select array_agg(value ->> 'timeline' order by value ->> 'timeline')
    into requested_domains
    from jsonb_array_elements(requested_mutations);
  if exists (
    select 1 from unnest(requested_domains) as domain
    where domain not in ('LABOR_CONDITIONS', 'SCHEDULE', 'SALARY', 'COST_ALLOCATION')
  ) then raise exception 'TIMELINE_UNKNOWN'; end if;
  if cardinality(requested_domains) <> cardinality(array(select distinct unnest(requested_domains))) then
    raise exception 'COMBINED_TIMELINE_DUPLICATE';
  end if;

  select * into employment from public.employments
    where id = requested_employment_id and deleted_at is null
    for update;
  if employment.id is null then raise exception 'EMPLOYMENT_NOT_FOUND'; end if;
  if requested_effective_on < employment.starts_on
     or (employment.ends_on is not null and requested_effective_on > employment.ends_on) then
    raise exception 'TIMELINE_DATE_OUTSIDE_EMPLOYMENT';
  end if;
  if not internal_security.current_user_has_permission(
    employment.tenant_id, employment.administration_id, 'contract:write'
  ) then raise exception 'FORBIDDEN'; end if;
  if 'SALARY' = any(requested_domains) and not internal_security.current_user_has_permission(
    employment.tenant_id, employment.administration_id, 'salary:write'
  ) then raise exception 'FORBIDDEN'; end if;

  insert into public.employment_change_sets (
    tenant_id, administration_id, employee_id, employment_id, effective_on,
    reason, domains, warning_codes, acknowledgements
  ) values (
    employment.tenant_id, employment.administration_id, employment.employee_id, employment.id,
    requested_effective_on, requested_reason, requested_domains,
    requested_warning_codes, requested_acknowledgements
  ) returning id into change_id;
  perform set_config('app.change_set_id', change_id::text, true);

  for mutation in select value from jsonb_array_elements(requested_mutations) loop
    requested_timeline := mutation ->> 'timeline';
    requested_payload := mutation -> 'payload';
    if requested_payload is null or jsonb_typeof(requested_payload) <> 'object' then
      raise exception 'TIMELINE_PAYLOAD_INVALID';
    end if;

    if requested_timeline = 'LABOR_CONDITIONS' then
      if nullif(requested_payload ->> 'conditionGroup', '') is null then raise exception 'TIMELINE_PAYLOAD_INVALID'; end if;
      if exists (select 1 from public.employment_labor_conditions where employment_id = employment.id and valid_from = requested_effective_on) then raise exception 'TIMELINE_EFFECTIVE_DATE_CONFLICT'; end if;
      select min(valid_from) into next_date from public.employment_labor_conditions where employment_id = employment.id and valid_from > requested_effective_on;
      update public.employment_labor_conditions set valid_until = requested_effective_on
        where employment_id = employment.id and valid_from < requested_effective_on and (valid_until is null or valid_until > requested_effective_on);
      insert into public.employment_labor_conditions (tenant_id, administration_id, employee_id, employment_id, condition_group, valid_from, valid_until, change_set_id)
      values (employment.tenant_id, employment.administration_id, employment.employee_id, employment.id, requested_payload ->> 'conditionGroup', requested_effective_on, next_date, change_id);

    elsif requested_timeline = 'SCHEDULE' then
      if exists (select 1 from public.employment_schedules where employment_id = employment.id and valid_from = requested_effective_on) then raise exception 'TIMELINE_EFFECTIVE_DATE_CONFLICT'; end if;
      select min(valid_from) into next_date from public.employment_schedules where employment_id = employment.id and valid_from > requested_effective_on;
      update public.employment_schedules set valid_until = requested_effective_on
        where employment_id = employment.id and valid_from < requested_effective_on and (valid_until is null or valid_until > requested_effective_on);
      insert into public.employment_schedules (
        tenant_id, administration_id, employee_id, employment_id, schedule_type, start_week,
        average_days_per_week, average_hours_per_week, part_time_factor, time_for_time_accrual,
        monday_hours, tuesday_hours, wednesday_hours, thursday_hours, friday_hours, saturday_hours, sunday_hours,
        valid_from, valid_until, change_set_id
      ) values (
        employment.tenant_id, employment.administration_id, employment.employee_id, employment.id,
        (requested_payload ->> 'scheduleType')::public.schedule_type, coalesce((requested_payload ->> 'startWeek')::smallint, 1),
        (requested_payload ->> 'averageDaysPerWeek')::numeric, (requested_payload ->> 'averageHoursPerWeek')::numeric,
        (requested_payload ->> 'partTimeFactor')::numeric, coalesce((requested_payload ->> 'timeForTimeAccrual')::numeric, 0),
        nullif(requested_payload ->> 'mondayHours', '')::numeric, nullif(requested_payload ->> 'tuesdayHours', '')::numeric,
        nullif(requested_payload ->> 'wednesdayHours', '')::numeric, nullif(requested_payload ->> 'thursdayHours', '')::numeric,
        nullif(requested_payload ->> 'fridayHours', '')::numeric, nullif(requested_payload ->> 'saturdayHours', '')::numeric,
        nullif(requested_payload ->> 'sundayHours', '')::numeric, requested_effective_on, next_date, change_id
      );

    elsif requested_timeline = 'SALARY' then
      route := (requested_payload ->> 'salaryRoute')::public.salary_application_route;
      if route is null then raise exception 'SALARY_ROUTE_REQUIRED'; end if;
      select * into settings
      from public.administration_hr_settings
      where tenant_id = employment.tenant_id
        and administration_id = employment.administration_id;
      if settings.id is null or not route = any(settings.salary_routes) then
        raise exception 'SALARY_ROUTE_DISABLED';
      end if;
      selected_structure_id := nullif(requested_payload ->> 'salaryStructureId', '')::uuid;
      selected_scale_id := nullif(requested_payload ->> 'salaryScaleId', '')::uuid;
      selected_band_id := nullif(requested_payload ->> 'salaryBandId', '')::uuid;
      if selected_structure_id is not null and not selected_structure_id = any(settings.salary_structure_ids) then
        raise exception 'SALARY_STRUCTURE_NOT_AVAILABLE';
      end if;
      if route = 'SCALE_WITH_STEPS' then
        if selected_structure_id is null or selected_scale_id is null or nullif(requested_payload ->> 'salaryStepCode', '') is null then
          raise exception 'SALARY_SCALE_SELECTION_REQUIRED';
        end if;
        if not exists (
          select 1 from public.salary_structures structure
          where structure.tenant_id = employment.tenant_id
            and structure.hr_group_id = employment.hr_group_id
            and structure.id = selected_structure_id
            and structure.structure_type = 'SCALE_WITH_STEPS'
            and structure.is_active
        ) then raise exception 'SALARY_SCALE_STRUCTURE_NOT_AVAILABLE'; end if;
      elsif route = 'SALARY_BAND' then
        if selected_structure_id is null or selected_band_id is null then raise exception 'SALARY_BAND_SELECTION_REQUIRED'; end if;
        if not exists (
          select 1 from public.salary_structures structure
          where structure.tenant_id = employment.tenant_id
            and structure.hr_group_id = employment.hr_group_id
            and structure.id = selected_structure_id
            and structure.structure_type = 'SALARY_BAND'
            and structure.is_active
        ) then raise exception 'SALARY_BAND_STRUCTURE_NOT_AVAILABLE'; end if;
      elsif route = 'MINIMUM_WAGE' then
        scheme := (requested_payload ->> 'minimumWageScheme')::public.minimum_wage_scheme;
        if scheme is null then raise exception 'MINIMUM_WAGE_SCHEME_REQUIRED'; end if;
      else
        scheme := null;
      end if;
      if exists (select 1 from public.employment_salaries where employment_id = employment.id and valid_from = requested_effective_on) then raise exception 'TIMELINE_EFFECTIVE_DATE_CONFLICT'; end if;
      select min(valid_from) into next_date from public.employment_salaries where employment_id = employment.id and valid_from > requested_effective_on;
      update public.employment_salaries set valid_until = requested_effective_on
        where employment_id = employment.id and valid_from < requested_effective_on and (valid_until is null or valid_until > requested_effective_on);
      insert into public.employment_salaries (
        tenant_id, administration_id, employee_id, employment_id,
        payment_type, payment_frequency, salary_basis, fulltime_amount, parttime_amount, hourly_rate, currency_code,
        salary_scale_step_id, cao_scale_name, cao_step_name, salary_route, minimum_wage_scheme,
        salary_structure_id, salary_scale_id, salary_step_code, salary_band_id,
        valid_from, valid_until, change_set_id
      ) values (
        employment.tenant_id, employment.administration_id, employment.employee_id, employment.id,
        coalesce((requested_payload ->> 'paymentType')::public.salary_payment_type, 'PERIODIC_FIXED'),
        (requested_payload ->> 'paymentFrequency')::public.salary_frequency,
        case route when 'SCALE_WITH_STEPS' then 'CUSTOM_SCALE'::public.salary_basis when 'MINIMUM_WAGE' then 'MINIMUM_WAGE'::public.salary_basis else 'MANUAL'::public.salary_basis end,
        nullif(requested_payload ->> 'fulltimeAmount', '')::numeric,
        nullif(requested_payload ->> 'parttimeAmount', '')::numeric,
        nullif(requested_payload ->> 'hourlyRate', '')::numeric,
        coalesce(requested_payload ->> 'currencyCode', 'EUR'),
        nullif(requested_payload ->> 'salaryScaleStepId', '')::uuid,
        nullif(requested_payload ->> 'caoScaleName', ''), nullif(requested_payload ->> 'caoStepName', ''),
        route, scheme, selected_structure_id, selected_scale_id,
        nullif(requested_payload ->> 'salaryStepCode', ''), selected_band_id,
        requested_effective_on, next_date, change_id
      );

    else
      select count(*), coalesce(sum((value ->> 'percentage')::numeric), 0)
        into allocation_count, allocation_total from jsonb_array_elements(requested_payload -> 'allocations');
      if allocation_count = 0 or allocation_total <> 100 then raise exception 'COST_ALLOCATION_TOTAL_INVALID'; end if;
      if exists (select 1 from public.employment_cost_allocations where employment_id = employment.id and valid_from = requested_effective_on) then raise exception 'TIMELINE_EFFECTIVE_DATE_CONFLICT'; end if;
      select min(valid_from) into next_date from public.employment_cost_allocations where employment_id = employment.id and valid_from > requested_effective_on;
      update public.employment_cost_allocations set valid_until = requested_effective_on
        where employment_id = employment.id and valid_from < requested_effective_on and (valid_until is null or valid_until > requested_effective_on);
      for allocation in select value from jsonb_array_elements(requested_payload -> 'allocations') loop
        insert into public.employment_cost_allocations (tenant_id, administration_id, employee_id, employment_id, cost_center_id, percentage, valid_from, valid_until, change_set_id)
        values (employment.tenant_id, employment.administration_id, employment.employee_id, employment.id, (allocation ->> 'costCenterId')::uuid, (allocation ->> 'percentage')::numeric, requested_effective_on, next_date, change_id);
      end loop;
    end if;
  end loop;

  update public.employment_change_sets set status = 'APPLIED', applied_at = timezone('utc', now()) where id = change_id;
  return change_id;
end;
$$;

revoke all on function public.save_administration_salary_settings(uuid, public.salary_application_route[], uuid[]) from public, anon;
grant execute on function public.save_administration_salary_settings(uuid, public.salary_application_route[], uuid[]) to authenticated;
revoke all on function public.apply_salary_application_change(uuid, date, jsonb, text, text[], jsonb) from public, anon;
grant execute on function public.apply_salary_application_change(uuid, date, jsonb, text, text[], jsonb) to authenticated;
revoke all on function public.apply_combined_salary_application_change(uuid, date, jsonb, text, text[], jsonb) from public, anon;
grant execute on function public.apply_combined_salary_application_change(uuid, date, jsonb, text, text[], jsonb) to authenticated;

revoke all on public.administration_hr_settings from anon;
grant select, insert, update on public.administration_hr_settings to authenticated;

-- Nieuwe aanmaakroute: de bestaande publicatie-RPC blijft de transactionele
-- employment/contract/schedule-grens; deze wrapper voegt de salary-application
-- toe met dezelfde security- en validatiegrens als latere mutaties.
create or replace function public.publish_complete_salary_application_employment(
  requested_employee_id uuid,
  requested_administration_id uuid,
  requested_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  salary_payload jsonb := requested_payload -> 'salary';
  base_payload jsonb := requested_payload - 'salary';
  employee_row public.employees%rowtype;
  employment_row public.employments%rowtype;
  settings_row public.administration_hr_settings%rowtype;
  created_employment_id uuid;
  salary_change_set_id uuid;
  salary_frequency_code text;
  route public.salary_application_route;
  scheme public.minimum_wage_scheme;
  selected_structure_id uuid;
  selected_scale_id uuid;
  selected_band_id uuid;
begin
  if jsonb_typeof(salary_payload) <> 'object'
     or nullif(salary_payload ->> 'salaryRoute', '') is null then
    raise exception 'SALARY_APPLICATION_PAYLOAD_REQUIRED';
  end if;

  route := (salary_payload ->> 'salaryRoute')::public.salary_application_route;
  select employee.* into employee_row
  from public.employees employee
  where employee.id = requested_employee_id
    and employee.deleted_at is null
  for update;
  if employee_row.id is null then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  if not internal_security.current_user_has_permission(
    employee_row.tenant_id, requested_administration_id, 'salary:write'
  ) then raise exception 'FORBIDDEN'; end if;

  created_employment_id := public.publish_complete_employment(
    requested_employee_id, requested_administration_id, base_payload
  );

  select employment.* into employment_row
  from public.employments employment
  where employment.id = created_employment_id
    and employment.tenant_id = employee_row.tenant_id
    and employment.administration_id = requested_administration_id
    and employment.employee_id = requested_employee_id
  for update;
  if employment_row.id is null then raise exception 'EMPLOYMENT_NOT_FOUND'; end if;

  select settings.* into settings_row
  from public.administration_hr_settings settings
  where settings.tenant_id = employee_row.tenant_id
    and settings.hr_group_id = employee_row.hr_group_id
    and settings.administration_id = requested_administration_id;
  if settings_row.id is null or not route = any(settings_row.salary_routes) then
    raise exception 'SALARY_ROUTE_NOT_CONFIGURED';
  end if;

  selected_structure_id := nullif(salary_payload ->> 'salaryStructureId', '')::uuid;
  selected_scale_id := nullif(salary_payload ->> 'salaryScaleId', '')::uuid;
  selected_band_id := nullif(salary_payload ->> 'salaryBandId', '')::uuid;

  if route in ('SCALE_WITH_STEPS', 'SALARY_BAND')
     and (selected_structure_id is null or not selected_structure_id = any(settings_row.salary_structure_ids)) then
    raise exception 'SALARY_STRUCTURE_NOT_CONFIGURED';
  end if;
  if route = 'MINIMUM_WAGE' then
    scheme := nullif(salary_payload ->> 'minimumWageScheme', '')::public.minimum_wage_scheme;
    if scheme is null then raise exception 'MINIMUM_WAGE_SCHEME_REQUIRED'; end if;
  end if;

  select frequency.code into salary_frequency_code
  from public.salary_frequencies frequency
  where frequency.tenant_id = employee_row.tenant_id
    and frequency.administration_id = requested_administration_id
    and frequency.id = (salary_payload ->> 'salaryFrequencyId')::uuid
    and frequency.is_active;
  if salary_frequency_code is null then raise exception 'SALARY_FREQUENCY_NOT_FOUND'; end if;

  insert into public.employment_change_sets (
    tenant_id, administration_id, employee_id, employment_id, effective_on,
    reason, domains, status, applied_at, created_by_user_id
  ) values (
    employee_row.tenant_id, requested_administration_id, requested_employee_id,
    created_employment_id, employment_row.starts_on, 'EMPLOYMENT_CREATED_SALARY',
    array['SALARY'], 'APPLIED', timezone('utc', now()), (select auth.uid())
  ) returning id into salary_change_set_id;
  perform set_config('app.change_set_id', salary_change_set_id::text, true);

  insert into public.employment_salaries (
    tenant_id, administration_id, employee_id, employment_id, payment_type,
    payment_frequency, salary_frequency_id, salary_basis, fulltime_amount,
    parttime_amount, hourly_rate, currency_code, salary_scale_step_id,
    cao_scale_name, cao_step_name, salary_route, minimum_wage_scheme,
    salary_structure_id, salary_scale_id, salary_step_code, salary_band_id,
    valid_from, valid_until, change_set_id
  ) values (
    employee_row.tenant_id, requested_administration_id, requested_employee_id,
    created_employment_id, (salary_payload ->> 'paymentType')::public.salary_payment_type,
    salary_frequency_code::public.salary_frequency,
    (salary_payload ->> 'salaryFrequencyId')::uuid,
    (salary_payload ->> 'salaryBasis')::public.salary_basis,
    nullif(salary_payload ->> 'fulltimeAmount', '')::numeric,
    nullif(salary_payload ->> 'parttimeAmount', '')::numeric,
    nullif(salary_payload ->> 'hourlyRate', '')::numeric,
    coalesce(salary_payload ->> 'currencyCode', 'EUR'),
    nullif(salary_payload ->> 'salaryScaleStepId', '')::uuid,
    nullif(salary_payload ->> 'caoScaleName', ''),
    nullif(salary_payload ->> 'caoStepName', ''),
    route, scheme, selected_structure_id, selected_scale_id,
    nullif(salary_payload ->> 'salaryStepCode', ''), selected_band_id,
    employment_row.starts_on, employment_row.ends_on, salary_change_set_id
  );

  return created_employment_id;
end;
$$;

revoke all on function public.publish_complete_salary_application_employment(uuid, uuid, jsonb) from public, anon;
grant execute on function public.publish_complete_salary_application_employment(uuid, uuid, jsonb) to authenticated;
