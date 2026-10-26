begin;

create table public.actual_work_payroll_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid not null,
  work_hour_type_id uuid not null,
  salary_component_id text,
  salary_component_code text,
  salary_component_version text,
  salary_component_output text,
  processing_target text not null,
  calculation_rule text not null,
  factor numeric(18,8),
  valid_from date not null,
  valid_until date,
  version_number integer not null default 1,
  supersedes_mapping_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint actual_work_payroll_mappings_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete restrict,
  constraint actual_work_payroll_mappings_administration_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete restrict,
  constraint actual_work_payroll_mappings_type_fkey
    foreign key (tenant_id, hr_group_id, work_hour_type_id)
    references public.work_hour_types(tenant_id, hr_group_id, id) on delete restrict,
  constraint actual_work_payroll_mappings_successor_fkey
    foreign key (supersedes_mapping_id) references public.actual_work_payroll_mappings(id) on delete restrict,
  constraint actual_work_payroll_mappings_version_check check (version_number > 0),
  constraint actual_work_payroll_mappings_effective_range_check check (valid_until is null or valid_until >= valid_from),
  constraint actual_work_payroll_mappings_target_check check (
    (processing_target in ('INFORMATIONAL', 'TVT')
      and salary_component_id is null and salary_component_code is null
      and salary_component_version is null and salary_component_output is null
      and calculation_rule = 'NONE' and factor is null)
    or
    (processing_target = 'PAYMENT'
      and salary_component_id is not null and salary_component_code is not null
      and salary_component_version is not null and salary_component_output is not null
      and factor is not null and factor > 0
      and salary_component_id <> ''
      and salary_component_id = 'system:payfull02:payfull02_variable_regular_wage'
      and salary_component_code = 'PAYFULL02_VARIABLE_REGULAR_WAGE'
      and salary_component_version = '2026.1-payfull02'
      and salary_component_output = 'amount'
      and calculation_rule = 'HOURLY_RATE_X_HOURS')
  ),
  constraint actual_work_payroll_mappings_version_identity_unique
    unique (tenant_id, administration_id, work_hour_type_id, processing_target,
      salary_component_code, valid_from, version_number),
  constraint actual_work_payroll_mappings_scoped_id_unique
    unique (tenant_id, hr_group_id, administration_id, id)
);

create index actual_work_payroll_mappings_effective_idx
  on public.actual_work_payroll_mappings
    (tenant_id, hr_group_id, administration_id, work_hour_type_id, valid_from, valid_until);

create table public.actual_work_payroll_releases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  entry_id uuid not null,
  entry_revision_number integer not null check (entry_revision_number > 0),
  payroll_period_start date not null,
  mapping_id uuid not null,
  release_class text not null default 'INITIAL' check (release_class in ('INITIAL', 'TWK_REQUIRED')),
  supersedes_release_id uuid references public.actual_work_payroll_releases(id) on delete restrict,
  work_hour_type_updated_at timestamptz not null,
  content_fingerprint text not null check (content_fingerprint ~ '^[0-9a-f]{64}$'),
  released_by uuid not null references auth.users(id) on delete restrict,
  released_at timestamptz not null default timezone('utc', now()),
  constraint actual_work_payroll_releases_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete restrict,
  constraint actual_work_payroll_releases_administration_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete restrict,
  constraint actual_work_payroll_releases_employee_fkey
    foreign key (tenant_id, hr_group_id, employee_id)
    references public.employees(tenant_id, hr_group_id, id) on delete restrict,
  constraint actual_work_payroll_releases_employment_fkey
    foreign key (tenant_id, hr_group_id, employment_id)
    references public.employments(tenant_id, hr_group_id, id) on delete restrict,
  constraint actual_work_payroll_releases_entry_fkey
    foreign key (tenant_id, hr_group_id, entry_id)
    references public.employment_work_hour_entries(tenant_id, hr_group_id, id) on delete restrict,
  constraint actual_work_payroll_releases_revision_fkey
    foreign key (entry_id, entry_revision_number)
    references public.actual_work_revisions(entry_id, revision_number) on delete restrict,
  constraint actual_work_payroll_releases_mapping_fkey
    foreign key (tenant_id, hr_group_id, administration_id, mapping_id)
    references public.actual_work_payroll_mappings(tenant_id, hr_group_id, administration_id, id) on delete restrict,
  constraint actual_work_payroll_releases_period_check
    check (payroll_period_start = date_trunc('month', payroll_period_start)::date),
  constraint actual_work_payroll_releases_idempotency_unique
    unique (entry_id, entry_revision_number, payroll_period_start, mapping_id)
);

create index actual_work_payroll_releases_scope_period_idx
  on public.actual_work_payroll_releases
    (tenant_id, hr_group_id, administration_id, payroll_period_start, employee_id, employment_id);
create index actual_work_payroll_releases_entry_idx
  on public.actual_work_payroll_releases (tenant_id, hr_group_id, entry_id, released_at desc);

create or replace function internal_security.reject_actual_work_payroll_release_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '55000', message = 'ACTUAL_WORK_PAYROLL_RELEASE_IMMUTABLE';
end;
$$;

create trigger actual_work_payroll_releases_immutable
before update or delete on public.actual_work_payroll_releases
for each row execute function internal_security.reject_actual_work_payroll_release_mutation();

create or replace function internal_security.prepare_actual_work_payroll_mapping_version()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  predecessor public.actual_work_payroll_mappings%rowtype;
begin
  if actor_id is null
    or not internal_security.current_user_has_hr_group_permission(new.tenant_id, new.hr_group_id, 'salary:write')
    or not internal_security.current_user_has_audience_role(new.tenant_id, array['HR_ADMIN', 'TENANT_ADMIN']) then
    raise exception using errcode = '42501', message = 'ACTUAL_WORK_PAYROLL_MAPPING_NOT_AUTHORIZED';
  end if;
  if not exists (
    select 1 from public.work_hour_types type
    where type.tenant_id = new.tenant_id and type.hr_group_id = new.hr_group_id
      and type.id = new.work_hour_type_id and type.is_active
      and (type.administration_id is null or type.administration_id = new.administration_id)
      and type.family <> 'TRANSPARENT'
  ) then
    raise exception using errcode = '23503', message = 'ACTUAL_WORK_PAYROLL_TYPE_NOT_APPLICABLE';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    new.tenant_id::text || ':' || new.hr_group_id::text || ':' || new.administration_id::text
      || ':' || new.work_hour_type_id::text || ':' || new.processing_target || ':'
      || coalesce(new.salary_component_code, ''),
    0
  ));
  if new.processing_target = 'TVT' and not exists (
    select 1
    from public.leave_type_overtime_work_hours link
    join public.leave_types leave_type
      on leave_type.tenant_id = link.tenant_id and leave_type.hr_group_id = link.hr_group_id
      and leave_type.id = link.leave_type_id
    where link.tenant_id = new.tenant_id and link.hr_group_id = new.hr_group_id
      and link.work_hour_type_id = new.work_hour_type_id
      and (link.administration_id is null or link.administration_id = new.administration_id)
      and leave_type.entitlement_mode = 'OVERTIME_HOURS' and leave_type.is_active
  ) then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_PAYROLL_TVT_MAPPING_REQUIRED';
  end if;
  if new.processing_target = 'PREMIUM' then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_PAYROLL_COMPONENT_SOURCE_GAP';
  end if;
  if new.processing_target = 'PAYMENT' and exists (
    select 1 from public.work_hour_types type
    where type.tenant_id = new.tenant_id and type.hr_group_id = new.hr_group_id
      and type.id = new.work_hour_type_id and type.family = 'OVERTIME'
  ) then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_PAYROLL_COMPONENT_SOURCE_GAP';
  end if;
  if new.processing_target = 'PAYMENT'
    and exists (
      select 1
      from public.leave_type_overtime_work_hours link
      join public.leave_types leave_type
        on leave_type.tenant_id = link.tenant_id and leave_type.hr_group_id = link.hr_group_id
        and leave_type.id = link.leave_type_id
      where link.tenant_id = new.tenant_id and link.hr_group_id = new.hr_group_id
        and link.work_hour_type_id = new.work_hour_type_id
        and (link.administration_id is null or link.administration_id = new.administration_id)
        and leave_type.entitlement_mode = 'OVERTIME_HOURS' and leave_type.is_active
    ) then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_PAYROLL_TVT_DOUBLE_PAYMENT';
  end if;

  select mapping.* into predecessor
  from public.actual_work_payroll_mappings mapping
  where mapping.tenant_id = new.tenant_id and mapping.hr_group_id = new.hr_group_id
    and mapping.administration_id = new.administration_id
    and mapping.work_hour_type_id = new.work_hour_type_id
    and mapping.processing_target = new.processing_target
    and (new.processing_target = 'PAYMENT' or mapping.salary_component_code is not distinct from new.salary_component_code)
    and mapping.valid_from < new.valid_from
    and (mapping.valid_until is null or mapping.valid_until >= new.valid_from)
  order by mapping.valid_from desc, mapping.version_number desc
  limit 1
  for update;

  if found then
    update public.actual_work_payroll_mappings
    set valid_until = new.valid_from - 1,
        updated_by = actor_id,
        updated_at = timezone('utc', now())
    where id = predecessor.id;
    new.supersedes_mapping_id := predecessor.id;
  end if;

  if exists (
    select 1 from public.actual_work_payroll_mappings mapping
    where mapping.tenant_id = new.tenant_id and mapping.hr_group_id = new.hr_group_id
      and mapping.administration_id = new.administration_id
      and mapping.work_hour_type_id = new.work_hour_type_id
      and mapping.processing_target = new.processing_target
      and (new.processing_target = 'PAYMENT' or mapping.salary_component_code is not distinct from new.salary_component_code)
      and mapping.valid_from <= coalesce(new.valid_until, 'infinity'::date)
      and coalesce(mapping.valid_until, 'infinity'::date) >= new.valid_from
  ) then
    raise exception using errcode = '23P01', message = 'ACTUAL_WORK_PAYROLL_MAPPING_EFFECTIVE_OVERLAP';
  end if;

  select coalesce(max(mapping.version_number), 0) + 1 into new.version_number
  from public.actual_work_payroll_mappings mapping
  where mapping.tenant_id = new.tenant_id and mapping.administration_id = new.administration_id
    and mapping.work_hour_type_id = new.work_hour_type_id
    and mapping.processing_target = new.processing_target
    and mapping.salary_component_code is not distinct from new.salary_component_code;
  new.created_by := actor_id;
  return new;
end;
$$;

create trigger actual_work_payroll_mappings_version
before insert on public.actual_work_payroll_mappings
for each row execute function internal_security.prepare_actual_work_payroll_mapping_version();

create trigger audit_actual_work_payroll_mappings
after insert or update on public.actual_work_payroll_mappings
for each row execute function internal_security.audit_configuration_change('actual_work_payroll_mappings');
create trigger audit_actual_work_payroll_releases
after insert on public.actual_work_payroll_releases
for each row execute function internal_security.audit_configuration_change('actual_work_payroll_releases');

alter table public.actual_work_payroll_mappings enable row level security;
alter table public.actual_work_payroll_releases enable row level security;

create policy actual_work_payroll_mappings_read
on public.actual_work_payroll_mappings for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:read'))
);
create policy actual_work_payroll_releases_read
on public.actual_work_payroll_releases for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:read'))
);

grant select on public.actual_work_payroll_mappings to authenticated;
grant select on public.actual_work_payroll_releases to authenticated;
revoke all on public.actual_work_payroll_releases from public, anon, authenticated;
grant select on public.actual_work_payroll_releases to authenticated;

create or replace function public.save_actual_work_payroll_mapping(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_work_hour_type_id uuid,
  requested_processing_target text,
  requested_salary_component_id text,
  requested_salary_component_code text,
  requested_salary_component_version text,
  requested_salary_component_output text,
  requested_calculation_rule text,
  requested_factor numeric,
  requested_valid_from date
)
returns public.actual_work_payroll_mappings
language plpgsql
security definer
set search_path = public, internal_security, auth, pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  saved_mapping public.actual_work_payroll_mappings%rowtype;
begin
  if actor_id is null
    or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'salary:write')
    or not internal_security.current_user_has_audience_role(requested_tenant_id, array['HR_ADMIN', 'TENANT_ADMIN']) then
    raise exception using errcode = '42501', message = 'ACTUAL_WORK_PAYROLL_MAPPING_NOT_AUTHORIZED';
  end if;
  if requested_processing_target = 'PREMIUM' then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_PAYROLL_COMPONENT_SOURCE_GAP';
  elsif requested_processing_target = 'PAYMENT' then
    if requested_salary_component_id <> 'system:payfull02:payfull02_variable_regular_wage'
      or requested_salary_component_code <> 'PAYFULL02_VARIABLE_REGULAR_WAGE'
      or requested_salary_component_version <> '2026.1-payfull02'
      or requested_salary_component_output <> 'amount'
      or requested_calculation_rule <> 'HOURLY_RATE_X_HOURS'
      or requested_factor is null or requested_factor <= 0 then
      raise exception using errcode = '23514', message = 'ACTUAL_WORK_PAYROLL_COMPONENT_SOURCE_GAP';
    end if;
  elsif requested_processing_target in ('TVT', 'INFORMATIONAL') then
    if requested_salary_component_id is not null or requested_salary_component_code is not null
      or requested_salary_component_version is not null or requested_salary_component_output is not null
      or requested_calculation_rule <> 'NONE' or requested_factor is not null then
      raise exception using errcode = '23514', message = 'ACTUAL_WORK_PAYROLL_NONPAYMENT_MAPPING_INVALID';
    end if;
  else
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_PAYROLL_MAPPING_TARGET_INVALID';
  end if;
  insert into public.actual_work_payroll_mappings (
    tenant_id, hr_group_id, administration_id, work_hour_type_id,
    processing_target, salary_component_id, salary_component_code,
    salary_component_version, salary_component_output, calculation_rule,
    factor, valid_from, created_by
  ) values (
    requested_tenant_id, requested_hr_group_id, requested_administration_id, requested_work_hour_type_id,
    requested_processing_target, requested_salary_component_id, requested_salary_component_code,
    requested_salary_component_version, requested_salary_component_output, requested_calculation_rule,
    requested_factor, requested_valid_from, actor_id
  ) returning * into saved_mapping;
  return saved_mapping;
end;
$$;

create or replace function public.save_actual_work_import_entry(
  requested_entry_id uuid,
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_work_hour_type_id uuid,
  requested_entry_granularity public.actual_work_entry_granularity,
  requested_subject_period_start date,
  requested_subject_period_end date,
  requested_posting_period_start date,
  requested_hours numeric,
  requested_status public.leave_work_hour_entry_status,
  requested_note text,
  requested_operation public.actual_work_revision_operation,
  requested_reason text,
  requested_source_key text
)
returns public.employment_work_hour_entries
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  existing_entry public.employment_work_hour_entries%rowtype;
  saved_entry public.employment_work_hour_entries%rowtype;
begin
  if requested_source_key is null or length(btrim(requested_source_key)) not between 1 and 180 then
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_IMPORT_SOURCE_KEY_INVALID';
  end if;
  if auth.uid() is null
    or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'salary:write')
    or not internal_security.current_user_has_audience_role(requested_tenant_id, array['HR_ADMIN', 'TENANT_ADMIN']) then
    raise exception using errcode = '42501', message = 'ACTUAL_WORK_IMPORT_NOT_AUTHORIZED';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    requested_tenant_id::text || ':' || requested_administration_id::text || ':' || requested_source_key,
    0
  ));
  if requested_operation <> 'CREATE' or requested_entry_id is not null then
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_IMPORT_CREATE_ONLY';
  end if;

  select entry.* into existing_entry
  from public.employment_work_hour_entries entry
  where entry.tenant_id = requested_tenant_id
    and entry.administration_id = requested_administration_id
    and entry.source_type = 'ACTUAL_WORK_CSV'
    and entry.source_key = requested_source_key
  for update;
  if found then
    if existing_entry.hr_group_id <> requested_hr_group_id
      or existing_entry.employee_id <> requested_employee_id
      or existing_entry.employment_id <> requested_employment_id
      or existing_entry.work_hour_type_id <> requested_work_hour_type_id
      or existing_entry.entry_granularity <> requested_entry_granularity
      or existing_entry.subject_period_start <> requested_subject_period_start
      or existing_entry.subject_period_end <> requested_subject_period_end
      or existing_entry.posting_period_start <> requested_posting_period_start
      or existing_entry.hours <> requested_hours then
      raise exception using errcode = '23505', message = 'ACTUAL_WORK_IMPORT_SOURCE_KEY_CONFLICT';
    end if;
    return existing_entry;
  end if;

  saved_entry := public.save_actual_work_entry(
    requested_entry_id, requested_tenant_id, requested_hr_group_id, requested_administration_id,
    requested_employee_id, requested_employment_id, requested_work_hour_type_id,
    requested_entry_granularity, requested_subject_period_start, requested_subject_period_end,
    requested_posting_period_start, requested_hours, requested_status, requested_note,
    requested_operation, requested_reason
  );

  update public.employment_work_hour_entries
  set source_type = 'ACTUAL_WORK_CSV', source_key = requested_source_key,
      updated_at = timezone('utc', now())
  where id = saved_entry.id and tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id and administration_id = requested_administration_id
  returning * into saved_entry;
  if not found then raise exception using errcode = '23503', message = 'ACTUAL_WORK_IMPORT_ENTRY_NOT_FOUND'; end if;
  return saved_entry;
end;
$$;

create or replace function public.release_actual_work_entries_for_payroll(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_payroll_period_start date,
  requested_entries jsonb
)
returns setof public.actual_work_payroll_releases
language plpgsql
security definer
set search_path = public, internal_security, auth, extensions, pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  item jsonb;
  entry_row public.employment_work_hour_entries%rowtype;
  type_row public.work_hour_types%rowtype;
  mapping_row public.actual_work_payroll_mappings%rowtype;
  revision_number integer;
  fingerprint text;
  prior_release_id uuid;
  release_class_value text;
  saved_release public.actual_work_payroll_releases%rowtype;
begin
  if actor_id is null
    or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'salary:write')
    or not internal_security.current_user_has_audience_role(requested_tenant_id, array['HR_ADMIN', 'TENANT_ADMIN']) then
    raise exception using errcode = '42501', message = 'ACTUAL_WORK_PAYROLL_RELEASE_NOT_AUTHORIZED';
  end if;
  if requested_payroll_period_start is null
    or requested_payroll_period_start <> date_trunc('month', requested_payroll_period_start)::date
    or jsonb_typeof(requested_entries) <> 'array'
    or jsonb_array_length(requested_entries) not between 1 and 250 then
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_PAYROLL_RELEASE_INPUT_INVALID';
  end if;
  if (select count(*) from jsonb_array_elements(requested_entries))
      <> (select count(distinct value ->> 'entryId') from jsonb_array_elements(requested_entries)) then
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_PAYROLL_RELEASE_DUPLICATE_ENTRY';
  end if;

  for item in select value from jsonb_array_elements(requested_entries)
  loop
    select entry.* into entry_row
    from public.employment_work_hour_entries entry
    where entry.id = (item ->> 'entryId')::uuid
      and entry.tenant_id = requested_tenant_id
      and entry.hr_group_id = requested_hr_group_id
      and entry.administration_id = requested_administration_id
      and entry.posting_period_start = requested_payroll_period_start
      and entry.status = 'APPROVED' and entry.approved_at is not null
    for update;
    if not found then raise exception using errcode = '23503', message = 'ACTUAL_WORK_PAYROLL_RELEASE_ENTRY_INVALID'; end if;

    select type.* into type_row
    from public.work_hour_types type
    where type.id = entry_row.work_hour_type_id
      and type.tenant_id = requested_tenant_id and type.hr_group_id = requested_hr_group_id
      and type.is_active and (type.administration_id is null or type.administration_id = requested_administration_id);
    if not found or type_row.family = 'TRANSPARENT' then
      raise exception using errcode = '23514', message = 'ACTUAL_WORK_PAYROLL_RELEASE_TYPE_INVALID';
    end if;

    select revision.revision_number into revision_number
    from public.actual_work_revisions revision
    where revision.entry_id = entry_row.id
    order by revision.revision_number desc
    limit 1;
    if revision_number is null or revision_number <> (item ->> 'revisionNumber')::integer then
      raise exception using errcode = '40001', message = 'ACTUAL_WORK_PAYROLL_RELEASE_REVISION_STALE';
    end if;

    select mapping.* into mapping_row
    from public.actual_work_payroll_mappings mapping
    where mapping.id = (item ->> 'mappingId')::uuid
      and mapping.tenant_id = requested_tenant_id
      and mapping.hr_group_id = requested_hr_group_id
      and mapping.administration_id = requested_administration_id
      and mapping.work_hour_type_id = entry_row.work_hour_type_id
      and mapping.processing_target = 'PAYMENT'
      and mapping.valid_from <= entry_row.subject_period_start
      and (mapping.valid_until is null or mapping.valid_until >= entry_row.subject_period_end - 1);
    if not found then raise exception using errcode = '23503', message = 'ACTUAL_WORK_PAYROLL_MAPPING_REQUIRED'; end if;

    if mapping_row.processing_target = 'PAYMENT' and type_row.family = 'OVERTIME' then
      raise exception using errcode = '23514', message = 'ACTUAL_WORK_PAYROLL_COMPONENT_SOURCE_GAP';
    end if;

    if mapping_row.processing_target = 'PAYMENT' and type_row.family = 'OVERTIME'
      and exists (
        select 1
        from public.leave_type_overtime_work_hours link
        join public.leave_types leave_type
          on leave_type.tenant_id = link.tenant_id and leave_type.hr_group_id = link.hr_group_id
          and leave_type.id = link.leave_type_id
        where link.tenant_id = requested_tenant_id and link.hr_group_id = requested_hr_group_id
          and link.work_hour_type_id = type_row.id
          and (link.administration_id is null or link.administration_id = requested_administration_id)
          and leave_type.entitlement_mode = 'OVERTIME_HOURS' and leave_type.is_active
      ) then
      raise exception using errcode = '23514', message = 'ACTUAL_WORK_PAYROLL_TVT_DOUBLE_PAYMENT';
    end if;

    select release.* into saved_release
    from public.actual_work_payroll_releases release
    where release.entry_id = entry_row.id
      and release.entry_revision_number = revision_number
      and release.payroll_period_start = requested_payroll_period_start
      and release.mapping_id = mapping_row.id
    for update;
    if found then
      -- Retry the same unchanged release as an idempotent read. Keep its
      -- original class and predecessor in the fingerprint.
      prior_release_id := saved_release.supersedes_release_id;
      release_class_value := saved_release.release_class;
    else
      select release.id into prior_release_id
      from public.actual_work_payroll_releases release
      where release.tenant_id = requested_tenant_id and release.hr_group_id = requested_hr_group_id
        and release.administration_id = requested_administration_id and release.entry_id = entry_row.id
      order by release.released_at desc, release.id desc
      limit 1;
      release_class_value := case when prior_release_id is null then 'INITIAL' else 'TWK_REQUIRED' end;
    end if;

    fingerprint := encode(extensions.digest(convert_to(jsonb_build_object(
      'entryId', entry_row.id,
      'employeeId', entry_row.employee_id,
      'employmentId', entry_row.employment_id,
      'workHourTypeId', entry_row.work_hour_type_id,
      'workDate', entry_row.work_date,
      'granularity', entry_row.entry_granularity,
      'subjectPeriodStart', entry_row.subject_period_start,
      'subjectPeriodEnd', entry_row.subject_period_end,
      'postingPeriodStart', entry_row.posting_period_start,
      'hours', entry_row.hours,
      'entryStatus', entry_row.status,
      'entryUpdatedAt', entry_row.updated_at,
      'revisionNumber', revision_number,
      'workHourTypeUpdatedAt', type_row.updated_at,
      'mappingId', mapping_row.id,
      'mappingVersion', mapping_row.version_number,
      'mappingComponentId', mapping_row.salary_component_id,
      'mappingComponentCode', mapping_row.salary_component_code,
      'mappingComponentVersion', mapping_row.salary_component_version,
      'mappingComponentOutput', mapping_row.salary_component_output,
      'mappingTarget', mapping_row.processing_target,
      'mappingRule', mapping_row.calculation_rule,
      'mappingFactor', mapping_row.factor,
      'mappingValidFrom', mapping_row.valid_from,
      'mappingValidUntil', mapping_row.valid_until,
      'releaseClass', release_class_value,
      'supersedesReleaseId', prior_release_id
    )::text, 'UTF8'), 'sha256'), 'hex');

    insert into public.actual_work_payroll_releases (
      tenant_id, hr_group_id, administration_id, employee_id, employment_id,
      entry_id, entry_revision_number, payroll_period_start, mapping_id,
      release_class, supersedes_release_id, work_hour_type_updated_at, content_fingerprint, released_by
    ) values (
      requested_tenant_id, requested_hr_group_id, requested_administration_id, entry_row.employee_id, entry_row.employment_id,
      entry_row.id, revision_number, requested_payroll_period_start, mapping_row.id,
      release_class_value, prior_release_id, type_row.updated_at, fingerprint, actor_id
    ) on conflict (entry_id, entry_revision_number, payroll_period_start, mapping_id) do nothing
    returning * into saved_release;

    if not found then
      select release.* into saved_release from public.actual_work_payroll_releases release
      where release.entry_id = entry_row.id and release.entry_revision_number = revision_number
        and release.payroll_period_start = requested_payroll_period_start and release.mapping_id = mapping_row.id;
      if saved_release.content_fingerprint <> fingerprint then
        raise exception using errcode = '40001', message = 'ACTUAL_WORK_PAYROLL_RELEASE_FINGERPRINT_CONFLICT';
      end if;
    end if;
    return next saved_release;
  end loop;
end;
$$;

-- Prevent callers from bypassing the correction reason by invoking the
-- canonical Actual Work RPC directly. The deferred check can see the
-- append-only revision inserted later in the same RPC transaction.
create or replace function internal_security.require_actual_work_correction_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.actual_work_revisions revision
    where revision.tenant_id = new.tenant_id
      and revision.hr_group_id = new.hr_group_id
      and revision.administration_id = new.administration_id
      and revision.employee_id = new.employee_id
      and revision.employment_id = new.employment_id
      and revision.entry_id = new.id
      and revision.operation = 'CORRECTION'
      and length(btrim(coalesce(revision.reason, ''))) > 0
      and revision.actor_user_id = auth.uid()
      and revision.created_at = new.updated_at
      and revision.subject_period_start = new.subject_period_start
      and revision.subject_period_end = new.subject_period_end
      and revision.posting_period_start = new.posting_period_start
      and revision.previous_hours = old.hours
      and revision.current_hours = new.hours
  ) then
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_CORRECTION_REASON_REQUIRED';
  end if;
  return null;
end;
$$;

revoke all on function internal_security.require_actual_work_correction_audit() from public, anon, authenticated;
drop trigger if exists actual_work_entry_correction_audit_required on public.employment_work_hour_entries;
create constraint trigger actual_work_entry_correction_audit_required
after update on public.employment_work_hour_entries
deferrable initially deferred
for each row
when (
  old.administration_id is distinct from new.administration_id
  or old.employee_id is distinct from new.employee_id
  or old.employment_id is distinct from new.employment_id
  or old.work_hour_type_id is distinct from new.work_hour_type_id
  or old.work_date is distinct from new.work_date
  or old.entry_granularity is distinct from new.entry_granularity
  or old.subject_period_start is distinct from new.subject_period_start
  or old.subject_period_end is distinct from new.subject_period_end
  or old.posting_period_start is distinct from new.posting_period_start
  or old.hours is distinct from new.hours
  or old.note is distinct from new.note
)
execute function internal_security.require_actual_work_correction_audit();

revoke all on function internal_security.prepare_actual_work_payroll_mapping_version() from public, anon, authenticated;
revoke all on function internal_security.reject_actual_work_payroll_release_mutation() from public, anon, authenticated;
revoke all on function public.save_actual_work_payroll_mapping(uuid, uuid, uuid, uuid, text, text, text, text, text, text, numeric, date) from public, anon;
grant execute on function public.save_actual_work_payroll_mapping(uuid, uuid, uuid, uuid, text, text, text, text, text, text, numeric, date) to authenticated;
revoke all on function public.save_actual_work_import_entry(uuid, uuid, uuid, uuid, uuid, uuid, uuid, public.actual_work_entry_granularity, date, date, date, numeric, public.leave_work_hour_entry_status, text, public.actual_work_revision_operation, text, text) from public, anon;
grant execute on function public.save_actual_work_import_entry(uuid, uuid, uuid, uuid, uuid, uuid, uuid, public.actual_work_entry_granularity, date, date, date, numeric, public.leave_work_hour_entry_status, text, public.actual_work_revision_operation, text, text) to authenticated;
revoke all on function public.release_actual_work_entries_for_payroll(uuid, uuid, uuid, date, jsonb) from public, anon;
grant execute on function public.release_actual_work_entries_for_payroll(uuid, uuid, uuid, date, jsonb) to authenticated;

revoke insert, update, delete on public.actual_work_payroll_mappings from public, anon, authenticated;
revoke insert, update, delete on public.actual_work_payroll_releases from public, anon, authenticated;
grant select on public.actual_work_payroll_releases to authenticated;

commit;
