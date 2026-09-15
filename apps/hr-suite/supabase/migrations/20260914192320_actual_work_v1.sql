begin;

do $$ begin
  create type public.actual_work_type_family as enum ('WORK', 'ADDITIONAL', 'OVERTIME', 'TRANSPARENT');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.actual_work_entry_granularity as enum ('DAY', 'PERIOD', 'BOTH');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.actual_work_limit_scope as enum ('DAY', 'WEEK', 'MONTH');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.actual_work_period_status as enum ('OPEN', 'CLOSED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.actual_work_revision_operation as enum ('CREATE', 'EDIT', 'CORRECTION', 'VOID');
exception when duplicate_object then null;
end $$;

alter table public.work_hour_types
  add column if not exists code text,
  add column if not exists family public.actual_work_type_family,
  add column if not exists valid_from date default date '2000-01-01',
  add column if not exists valid_until date,
  add column if not exists entry_granularity public.actual_work_entry_granularity not null default 'DAY',
  add column if not exists comment_required boolean not null default false,
  add column if not exists future_entry_allowed boolean not null default false,
  add column if not exists show_in_team_overview boolean not null default false,
  add column if not exists show_in_calendar boolean not null default false,
  add column if not exists approval_required boolean not null default false,
  add column if not exists display_order integer not null default 100;

update public.work_hour_types
set family = case category
  when 'OVERTIME' then 'OVERTIME'::public.actual_work_type_family
  when 'INFORMATIONAL' then 'TRANSPARENT'::public.actual_work_type_family
  else 'WORK'::public.actual_work_type_family
end
where family is null;

update public.work_hour_types
set code = 'LEGACY_' || replace(id::text, '-', '')
where code is null;

alter table public.work_hour_types
  alter column family set not null,
  alter column valid_from set not null;

alter table public.work_hour_types
  drop constraint if exists work_hour_types_validity_check;
alter table public.work_hour_types
  add constraint work_hour_types_validity_check
  check (valid_until is null or valid_until > valid_from);
alter table public.work_hour_types
  drop constraint if exists work_hour_types_code_check;
alter table public.work_hour_types
  add constraint work_hour_types_code_check
  check (code is null or length(btrim(code)) between 1 and 80);
alter table public.work_hour_types
  drop constraint if exists work_hour_types_display_order_check;
alter table public.work_hour_types
  add constraint work_hour_types_display_order_check
  check (display_order >= 0);

create unique index if not exists work_hour_types_group_code_key
  on public.work_hour_types (tenant_id, hr_group_id, code)
  where code is not null;

create or replace function public.sync_actual_work_type_category()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.family is null then
    new.family := case new.category
      when 'OVERTIME' then 'OVERTIME'::public.actual_work_type_family
      when 'INFORMATIONAL' then 'TRANSPARENT'::public.actual_work_type_family
      else 'WORK'::public.actual_work_type_family
    end;
  end if;

  new.category := case new.family
    when 'OVERTIME' then 'OVERTIME'::public.work_hour_type_category
    when 'TRANSPARENT' then 'INFORMATIONAL'::public.work_hour_type_category
    else 'REGULAR_WORK'::public.work_hour_type_category
  end;
  return new;
end;
$$;

drop trigger if exists actual_work_type_category_sync on public.work_hour_types;
create trigger actual_work_type_category_sync
before insert or update on public.work_hour_types
for each row execute function public.sync_actual_work_type_category();

alter table public.employment_work_hour_entries
  add column if not exists entry_granularity public.actual_work_entry_granularity not null default 'DAY',
  add column if not exists subject_period_start date,
  add column if not exists subject_period_end date,
  add column if not exists posting_period_start date,
  add column if not exists correction_reason text;

update public.employment_work_hour_entries
set subject_period_start = work_date,
    subject_period_end = work_date + 1,
    posting_period_start = date_trunc('month', work_date)::date
where subject_period_start is null
   or subject_period_end is null
   or posting_period_start is null;

alter table public.employment_work_hour_entries
  alter column subject_period_start set not null,
  alter column subject_period_end set not null,
  alter column posting_period_start set not null;

alter table public.employment_work_hour_entries
  drop constraint if exists employment_work_hour_entries_subject_period_valid;
alter table public.employment_work_hour_entries
  add constraint employment_work_hour_entries_subject_period_valid
  check (
    subject_period_end > subject_period_start
    and ((entry_granularity = 'DAY' and subject_period_end = subject_period_start + 1)
      or entry_granularity = 'PERIOD')
  );
alter table public.employment_work_hour_entries
  drop constraint if exists employment_work_hour_entries_posting_period_valid;
alter table public.employment_work_hour_entries
  add constraint employment_work_hour_entries_posting_period_valid
  check (posting_period_start = date_trunc('month', posting_period_start)::date);

create unique index if not exists employment_work_hour_entries_tenant_hr_group_id_key
  on public.employment_work_hour_entries (tenant_id, hr_group_id, id);

create or replace function public.prepare_actual_work_entry()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.subject_period_start is null then new.subject_period_start := new.work_date; end if;
  if new.subject_period_end is null then new.subject_period_end := new.subject_period_start + 1; end if;
  if new.posting_period_start is null then new.posting_period_start := date_trunc('month', new.subject_period_start)::date; end if;
  new.work_date := new.subject_period_start;
  if new.entry_granularity = 'DAY' then new.subject_period_end := new.subject_period_start + 1; end if;
  return new;
end;
$$;

drop trigger if exists actual_work_entry_prepare on public.employment_work_hour_entries;
create trigger actual_work_entry_prepare
before insert or update on public.employment_work_hour_entries
for each row execute function public.prepare_actual_work_entry();

alter table public.leave_accrual_rules
  alter column accrual_rate type numeric(18,8);

create table if not exists public.actual_work_type_limits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  work_hour_type_id uuid not null,
  limit_scope public.actual_work_limit_scope not null,
  max_hours numeric(12,4) not null check (max_hours > 0),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint actual_work_type_limits_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete cascade,
  constraint actual_work_type_limits_type_fkey
    foreign key (tenant_id, hr_group_id, work_hour_type_id)
    references public.work_hour_types(tenant_id, hr_group_id, id) on delete cascade,
  unique (tenant_id, hr_group_id, work_hour_type_id, limit_scope)
);

create table if not exists public.actual_work_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid,
  period_start date not null,
  period_end date not null,
  status public.actual_work_period_status not null default 'OPEN',
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint actual_work_periods_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete cascade,
  constraint actual_work_periods_valid check (
    period_end > period_start
    and period_start = date_trunc('month', period_start)::date
    and period_end = (period_start + interval '1 month')::date
  ),
  constraint actual_work_periods_closed_state check (
    (status = 'OPEN' and closed_at is null and closed_by is null)
    or (status = 'CLOSED' and closed_at is not null and closed_by is not null)
  ),
  unique (tenant_id, hr_group_id, period_start)
);

create table if not exists public.actual_work_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  entry_id uuid not null,
  revision_number integer not null check (revision_number > 0),
  operation public.actual_work_revision_operation not null,
  subject_period_start date not null,
  subject_period_end date not null,
  posting_period_start date not null,
  previous_hours numeric(12,4),
  current_hours numeric(12,4),
  delta_hours numeric(12,4) not null,
  reason text,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  constraint actual_work_revisions_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete restrict,
  constraint actual_work_revisions_employment_fkey
    foreign key (tenant_id, hr_group_id, employment_id)
    references public.employments(tenant_id, hr_group_id, id) on delete restrict,
  constraint actual_work_revisions_entry_fkey
    foreign key (tenant_id, hr_group_id, entry_id)
    references public.employment_work_hour_entries(tenant_id, hr_group_id, id) on delete restrict,
  constraint actual_work_revisions_type_shape_check check (
    (operation = 'CREATE' and previous_hours is null and current_hours is not null)
    or (operation in ('EDIT', 'CORRECTION') and previous_hours is not null and current_hours is not null)
    or (operation = 'VOID' and previous_hours is not null and current_hours is null)
  ),
  constraint actual_work_revisions_reason_check check (operation <> 'CORRECTION' or length(btrim(coalesce(reason, ''))) > 0),
  unique (entry_id, revision_number)
);

create index if not exists actual_work_type_limits_lookup_idx
  on public.actual_work_type_limits (tenant_id, hr_group_id, work_hour_type_id, limit_scope);
create index if not exists actual_work_periods_lookup_idx
  on public.actual_work_periods (tenant_id, hr_group_id, period_start, status);
create index if not exists actual_work_revisions_entry_idx
  on public.actual_work_revisions (tenant_id, hr_group_id, entry_id, revision_number);
create index if not exists actual_work_revisions_employment_idx
  on public.actual_work_revisions (tenant_id, hr_group_id, employment_id, subject_period_start);

drop trigger if exists actual_work_type_limits_updated on public.actual_work_type_limits;
create trigger actual_work_type_limits_updated before update on public.actual_work_type_limits
for each row execute function internal_security.set_updated_at();
drop trigger if exists actual_work_periods_updated on public.actual_work_periods;
create trigger actual_work_periods_updated before update on public.actual_work_periods
for each row execute function internal_security.set_updated_at();

drop trigger if exists audit_actual_work_type_limits on public.actual_work_type_limits;
create trigger audit_actual_work_type_limits after insert or update or delete on public.actual_work_type_limits
for each row execute function internal_security.audit_configuration_change('actual_work_type_limits');
drop trigger if exists audit_actual_work_periods on public.actual_work_periods;
create trigger audit_actual_work_periods after insert or update on public.actual_work_periods
for each row execute function internal_security.audit_configuration_change('actual_work_periods');
drop trigger if exists audit_actual_work_revisions on public.actual_work_revisions;
create trigger audit_actual_work_revisions after insert on public.actual_work_revisions
for each row execute function internal_security.audit_configuration_change('actual_work_revisions');

alter table public.actual_work_type_limits enable row level security;
alter table public.actual_work_periods enable row level security;
alter table public.actual_work_revisions enable row level security;

drop policy if exists actual_work_type_limits_read on public.actual_work_type_limits;
create policy actual_work_type_limits_read on public.actual_work_type_limits for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:read')));
drop policy if exists actual_work_type_limits_insert on public.actual_work_type_limits;
create policy actual_work_type_limits_insert on public.actual_work_type_limits for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:write')));
drop policy if exists actual_work_type_limits_update on public.actual_work_type_limits;
create policy actual_work_type_limits_update on public.actual_work_type_limits for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:write')));
drop policy if exists actual_work_type_limits_delete on public.actual_work_type_limits;
create policy actual_work_type_limits_delete on public.actual_work_type_limits for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:write')));

drop policy if exists actual_work_periods_read on public.actual_work_periods;
create policy actual_work_periods_read on public.actual_work_periods for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:read')));
drop policy if exists actual_work_periods_insert on public.actual_work_periods;
create policy actual_work_periods_insert on public.actual_work_periods for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:write')));
drop policy if exists actual_work_periods_update on public.actual_work_periods;
create policy actual_work_periods_update on public.actual_work_periods for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:write')));

drop policy if exists actual_work_revisions_read on public.actual_work_revisions;
create policy actual_work_revisions_read on public.actual_work_revisions for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:read')));
drop policy if exists actual_work_revisions_insert on public.actual_work_revisions;
create policy actual_work_revisions_insert on public.actual_work_revisions for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:write')));

grant select, insert, update, delete on table public.actual_work_type_limits to authenticated;
grant select, insert, update on table public.actual_work_periods to authenticated;
grant select, insert on table public.actual_work_revisions to authenticated;

create or replace function public.save_actual_work_entry(
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
  requested_reason text default null
)
returns public.employment_work_hour_entries
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  type_row public.work_hour_types%rowtype;
  employment_row public.employments%rowtype;
  old_entry public.employment_work_hour_entries%rowtype;
  saved_entry public.employment_work_hour_entries%rowtype;
  period_status public.actual_work_period_status;
  limit_row record;
  range_start date;
  range_end date;
  existing_hours numeric;
  target_id uuid := coalesce(requested_entry_id, gen_random_uuid());
  next_revision integer;
begin
  if actor_id is null or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'leave:write') then
    raise exception using errcode = '42501', message = 'ACTUAL_WORK_NOT_AUTHORIZED';
  end if;
  if requested_hours is null or requested_hours <= 0 or requested_hours <> round(requested_hours, 4) then
    raise exception using errcode = '22003', message = 'ACTUAL_WORK_HOURS_PRECISION_INVALID';
  end if;
  if requested_subject_period_start is null or requested_subject_period_end is null or requested_subject_period_end <= requested_subject_period_start then
    raise exception using errcode = '22007', message = 'ACTUAL_WORK_PERIOD_INVALID';
  end if;
  if requested_entry_granularity = 'DAY' and requested_subject_period_end <> requested_subject_period_start + 1 then
    raise exception using errcode = '22007', message = 'ACTUAL_WORK_DAY_RANGE_INVALID';
  end if;
  if requested_posting_period_start <> date_trunc('month', requested_posting_period_start)::date then
    raise exception using errcode = '22007', message = 'ACTUAL_WORK_POSTING_PERIOD_INVALID';
  end if;
  if requested_operation = 'CORRECTION' and length(btrim(coalesce(requested_reason, ''))) = 0 then
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_CORRECTION_REASON_REQUIRED';
  end if;

  select * into employment_row
  from public.employments
  where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id
    and administration_id = requested_administration_id and employee_id = requested_employee_id
    and id = requested_employment_id and record_status = 'CONFIRMED' and deleted_at is null
    and starts_on < requested_subject_period_end
    and (ends_on is null or ends_on >= requested_subject_period_start)
  limit 1;
  if not found then raise exception using errcode = '23503', message = 'ACTUAL_WORK_EMPLOYMENT_NOT_FOUND'; end if;

  select * into type_row
  from public.work_hour_types
  where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id and id = requested_work_hour_type_id
    and is_active and valid_from <= requested_subject_period_start
    and (valid_until is null or valid_until > requested_subject_period_start);
  if not found then raise exception using errcode = '23503', message = 'ACTUAL_WORK_TYPE_NOT_ACTIVE'; end if;
  if type_row.entry_granularity = 'PERIOD' and requested_entry_granularity = 'DAY' then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_DAY_ENTRY_NOT_ALLOWED';
  end if;
  if type_row.entry_granularity = 'DAY' and requested_entry_granularity = 'PERIOD' then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_PERIOD_ENTRY_NOT_ALLOWED';
  end if;
  if type_row.comment_required and length(btrim(coalesce(requested_note, ''))) = 0 then
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_COMMENT_REQUIRED';
  end if;
  if requested_subject_period_start > current_date and not type_row.future_entry_allowed then
    raise exception using errcode = '22007', message = 'ACTUAL_WORK_FUTURE_NOT_ALLOWED';
  end if;
  if type_row.family = 'ADDITIONAL' and not exists (
    select 1 from public.employment_schedules schedule
    where schedule.tenant_id = requested_tenant_id and schedule.hr_group_id = requested_hr_group_id
      and schedule.administration_id = requested_administration_id and schedule.employment_id = requested_employment_id
      and schedule.valid_from <= requested_subject_period_start
      and (schedule.valid_until is null or schedule.valid_until > requested_subject_period_start)
      and schedule.part_time_factor < 1
  ) then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_ADDITIONAL_ONLY_PART_TIME';
  end if;

  select status into period_status
  from public.actual_work_periods
  where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id
    and period_start = date_trunc('month', requested_subject_period_start)::date;
  if period_status = 'CLOSED' and requested_operation <> 'CORRECTION' then
    raise exception using errcode = '55000', message = 'ACTUAL_WORK_PERIOD_CLOSED';
  end if;

  if requested_entry_id is not null then
    select * into old_entry from public.employment_work_hour_entries where id = requested_entry_id for update;
    if not found or old_entry.tenant_id <> requested_tenant_id or old_entry.hr_group_id <> requested_hr_group_id then
      raise exception using errcode = '23503', message = 'ACTUAL_WORK_ENTRY_NOT_FOUND';
    end if;
    if requested_operation = 'CREATE' then raise exception using errcode = '22023', message = 'ACTUAL_WORK_ENTRY_ALREADY_EXISTS'; end if;
  elsif requested_operation <> 'CREATE' then
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_ENTRY_REQUIRED';
  end if;

  if requested_entry_granularity = 'PERIOD' and exists (
    select 1 from public.actual_work_type_limits where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id and work_hour_type_id = requested_work_hour_type_id
  ) then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_PERIOD_LIMIT_UNSUPPORTED';
  end if;
  if requested_entry_granularity = 'DAY' then
    for limit_row in
      select limit_scope, max_hours from public.actual_work_type_limits
      where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id and work_hour_type_id = requested_work_hour_type_id
    loop
      if limit_row.limit_scope = 'DAY' then
        range_start := requested_subject_period_start; range_end := range_start + 1;
      elsif limit_row.limit_scope = 'WEEK' then
        range_start := date_trunc('week', requested_subject_period_start)::date; range_end := range_start + 7;
      else
        range_start := date_trunc('month', requested_subject_period_start)::date; range_end := (range_start + interval '1 month')::date;
      end if;
      select coalesce(sum(hours), 0) into existing_hours
      from public.employment_work_hour_entries entry
      where entry.tenant_id = requested_tenant_id and entry.hr_group_id = requested_hr_group_id
        and entry.employment_id = requested_employment_id and entry.work_hour_type_id = requested_work_hour_type_id
        and entry.entry_granularity = 'DAY' and entry.status <> 'REVOKED'
        and entry.work_date >= range_start and entry.work_date < range_end
        and (requested_entry_id is null or entry.id <> requested_entry_id);
      if existing_hours + requested_hours > limit_row.max_hours then
        raise exception using errcode = '22003', message = 'ACTUAL_WORK_LIMIT_EXCEEDED';
      end if;
    end loop;
  end if;

  if requested_entry_id is null then
    insert into public.employment_work_hour_entries (
      id, tenant_id, administration_id, employee_id, employment_id, hr_group_id, work_hour_type_id,
      work_date, entry_granularity, subject_period_start, subject_period_end, posting_period_start,
      hours, status, source_type, source_key, note, approved_at, approved_by, created_by
    ) values (
      target_id, requested_tenant_id, requested_administration_id, requested_employee_id, requested_employment_id, requested_hr_group_id, requested_work_hour_type_id,
      requested_subject_period_start, requested_entry_granularity, requested_subject_period_start, requested_subject_period_end, requested_posting_period_start,
      requested_hours, requested_status, 'ACTUAL_WORK', 'ACTUAL_WORK:' || target_id::text, requested_note,
      case when requested_status = 'APPROVED' then timezone('utc', now()) else null end,
      case when requested_status = 'APPROVED' then actor_id else null end, actor_id
    ) returning * into saved_entry;
  else
    update public.employment_work_hour_entries
    set administration_id = requested_administration_id,
        employee_id = requested_employee_id,
        employment_id = requested_employment_id,
        work_hour_type_id = requested_work_hour_type_id,
        work_date = requested_subject_period_start,
        entry_granularity = requested_entry_granularity,
        subject_period_start = requested_subject_period_start,
        subject_period_end = requested_subject_period_end,
        posting_period_start = requested_posting_period_start,
        hours = requested_hours,
        status = requested_status,
        note = requested_note,
        correction_reason = case when requested_operation = 'CORRECTION' then requested_reason else correction_reason end,
        approved_at = case when requested_status = 'APPROVED' then coalesce(approved_at, timezone('utc', now())) else null end,
        approved_by = case when requested_status = 'APPROVED' then coalesce(approved_by, actor_id) else null end,
        updated_at = timezone('utc', now())
    where id = requested_entry_id
    returning * into saved_entry;
  end if;

  select coalesce(max(revision_number), 0) + 1 into next_revision
  from public.actual_work_revisions where entry_id = saved_entry.id;
  insert into public.actual_work_revisions (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id, entry_id, revision_number,
    operation, subject_period_start, subject_period_end, posting_period_start, previous_hours, current_hours, delta_hours, reason, actor_user_id
  ) values (
    saved_entry.tenant_id, saved_entry.hr_group_id, saved_entry.administration_id, saved_entry.employee_id, saved_entry.employment_id, saved_entry.id, next_revision,
    requested_operation, saved_entry.subject_period_start, saved_entry.subject_period_end, saved_entry.posting_period_start,
    case when requested_operation = 'CREATE' then null else old_entry.hours end,
    case when requested_operation = 'VOID' then null else saved_entry.hours end,
    case when requested_operation = 'VOID' then -old_entry.hours else saved_entry.hours - coalesce(old_entry.hours, 0) end,
    case when requested_operation = 'CORRECTION' then requested_reason else null end,
    actor_id
  );
  return saved_entry;
end;
$$;

create or replace function public.close_actual_work_period(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_period_start date,
  requested_period_end date
)
returns public.actual_work_periods
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  result_row public.actual_work_periods%rowtype;
begin
  if actor_id is null or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'leave:write') then
    raise exception using errcode = '42501', message = 'ACTUAL_WORK_NOT_AUTHORIZED';
  end if;
  if requested_period_start <> date_trunc('month', requested_period_start)::date
    or requested_period_end <> (requested_period_start + interval '1 month')::date then
    raise exception using errcode = '22007', message = 'ACTUAL_WORK_PERIOD_INVALID';
  end if;
  insert into public.actual_work_periods (tenant_id, hr_group_id, period_start, period_end, status, closed_at, closed_by, created_by)
  values (requested_tenant_id, requested_hr_group_id, requested_period_start, requested_period_end, 'CLOSED', timezone('utc', now()), actor_id, actor_id)
  on conflict (tenant_id, hr_group_id, period_start) do update
    set period_end = excluded.period_end, status = 'CLOSED', closed_at = excluded.closed_at, closed_by = excluded.closed_by, updated_at = timezone('utc', now())
  returning * into result_row;
  return result_row;
end;
$$;

revoke all on function public.save_actual_work_entry(uuid, uuid, uuid, uuid, uuid, uuid, uuid, public.actual_work_entry_granularity, date, date, date, numeric, public.leave_work_hour_entry_status, text, public.actual_work_revision_operation, text) from public, anon;
grant execute on function public.save_actual_work_entry(uuid, uuid, uuid, uuid, uuid, uuid, uuid, public.actual_work_entry_granularity, date, date, date, numeric, public.leave_work_hour_entry_status, text, public.actual_work_revision_operation, text) to authenticated;
revoke all on function public.close_actual_work_period(uuid, uuid, date, date) from public, anon;
grant execute on function public.close_actual_work_period(uuid, uuid, date, date) to authenticated;

-- Deterministic DEV configuration for the Planeten/Jupiter test scope.
do $$
declare
  seed_tenant_id uuid := '07249eb9-545c-883b-b26b-d52f83b4f4a1';
  seed_group_id uuid := '6ba6f1df-e376-40f2-abff-ffdf000172e1';
  actor_id uuid;
begin
  select coalesce(updated_by, created_by) into actor_id
  from public.leave_profiles leave_profile
  where leave_profile.tenant_id = seed_tenant_id and leave_profile.hr_group_id = seed_group_id and is_group_default
  order by created_at
  limit 1;

  insert into public.work_hour_types (id, tenant_id, administration_id, hr_group_id, code, name, category, family, is_active, color_code, is_self_service, pin_in_calendar, valid_from, entry_granularity, comment_required, future_entry_allowed, show_in_team_overview, show_in_calendar, approval_required, display_order)
  values
    ('00000000-0000-0000-0000-00000000a001', seed_tenant_id, null, seed_group_id, 'AW_WORK', 'Gewerkte uren', 'REGULAR_WORK', 'WORK', true, 'var(--chart-1)', false, true, '2026-01-01', 'DAY', false, false, true, true, false, 10),
    ('00000000-0000-0000-0000-00000000a002', seed_tenant_id, null, seed_group_id, 'AW_ADDITIONAL', 'Aanvullende uren deeltijd', 'REGULAR_WORK', 'ADDITIONAL', true, 'var(--chart-2)', false, false, '2026-01-01', 'BOTH', true, false, true, false, false, 20),
    ('00000000-0000-0000-0000-00000000a003', seed_tenant_id, null, seed_group_id, 'AW_OVERTIME', 'Overwerk Actual Work', 'OVERTIME', 'OVERTIME', true, 'var(--chart-3)', false, true, '2026-01-01', 'DAY', false, false, true, true, false, 30),
    ('00000000-0000-0000-0000-00000000a004', seed_tenant_id, null, seed_group_id, 'AW_TRANSPARENT', 'Thuiswerk informatief', 'INFORMATIONAL', 'TRANSPARENT', true, 'var(--chart-4)', false, false, '2026-01-01', 'DAY', false, false, true, true, false, 40),
    ('00000000-0000-0000-0000-00000000a005', seed_tenant_id, null, seed_group_id, 'AW_TRANSPARENT_FUTURE', 'Opleiding informatief', 'INFORMATIONAL', 'TRANSPARENT', true, 'var(--chart-5)', false, false, '2026-01-01', 'PERIOD', true, true, false, false, false, 50)
  on conflict (id) do update set updated_by = excluded.updated_by;

  insert into public.actual_work_type_limits (tenant_id, hr_group_id, work_hour_type_id, limit_scope, max_hours, created_by, updated_by)
  select seed_tenant_id, seed_group_id, type_id, scope, maximum, actor_id, actor_id
  from (values
    ('00000000-0000-0000-0000-00000000a001'::uuid, 'DAY'::public.actual_work_limit_scope, 8.0000::numeric),
    ('00000000-0000-0000-0000-00000000a001'::uuid, 'WEEK'::public.actual_work_limit_scope, 40.0000::numeric),
    ('00000000-0000-0000-0000-00000000a001'::uuid, 'MONTH'::public.actual_work_limit_scope, 160.0000::numeric),
    ('00000000-0000-0000-0000-00000000a002'::uuid, 'DAY'::public.actual_work_limit_scope, 8.0000::numeric),
    ('00000000-0000-0000-0000-00000000a002'::uuid, 'WEEK'::public.actual_work_limit_scope, 16.0000::numeric),
    ('00000000-0000-0000-0000-00000000a002'::uuid, 'MONTH'::public.actual_work_limit_scope, 64.0000::numeric),
    ('00000000-0000-0000-0000-00000000a003'::uuid, 'DAY'::public.actual_work_limit_scope, 4.0000::numeric),
    ('00000000-0000-0000-0000-00000000a003'::uuid, 'WEEK'::public.actual_work_limit_scope, 12.0000::numeric),
    ('00000000-0000-0000-0000-00000000a003'::uuid, 'MONTH'::public.actual_work_limit_scope, 40.0000::numeric)
  ) as seed(type_id, scope, maximum)
  on conflict (tenant_id, hr_group_id, work_hour_type_id, limit_scope) do update set max_hours = excluded.max_hours, updated_by = excluded.updated_by;

  insert into public.actual_work_periods (tenant_id, hr_group_id, period_start, period_end, status, closed_at, closed_by, created_by)
  values
    (seed_tenant_id, seed_group_id, '2026-08-01', '2026-09-01', 'CLOSED', timezone('utc', now()), actor_id, actor_id),
    (seed_tenant_id, seed_group_id, '2026-09-01', '2026-10-01', 'OPEN', null, null, actor_id),
    (seed_tenant_id, seed_group_id, '2026-10-01', '2026-11-01', 'OPEN', null, null, actor_id),
    (seed_tenant_id, seed_group_id, '2026-11-01', '2026-12-01', 'OPEN', null, null, actor_id)
  on conflict (tenant_id, hr_group_id, period_start) do update set period_end = excluded.period_end;

  insert into public.leave_types (id, tenant_id, administration_id, hr_group_id, name, color_code, is_system, is_active, is_self_service, entitlement_mode)
  values ('00000000-0000-0000-0000-00000000b001', seed_tenant_id, null, seed_group_id, 'Actual Work verlofbron', 'var(--chart-2)', false, true, false, 'ACCRUAL')
  on conflict (id) do update set is_active = true;

  insert into public.leave_accrual_rules (id, tenant_id, administration_id, hr_group_id, leave_profile_id, leave_type_id, valid_from, accrual_basis, accrual_frequency, accrual_timing, accrual_amount, accrual_rate, expiration_months, created_by)
  select '00000000-0000-0000-0000-00000000b002', seed_tenant_id, null, seed_group_id, profile.id, '00000000-0000-0000-0000-00000000b001', '2026-01-01', 'WORKED_HOURS', 'MONTHLY', 'ARREARS', null, 0.08333333, 60, actor_id
  from public.leave_profiles profile
  where profile.tenant_id = seed_tenant_id and profile.hr_group_id = seed_group_id and profile.is_group_default
  on conflict (id) do nothing;

  insert into public.leave_accrual_rule_work_hour_types (tenant_id, administration_id, hr_group_id, accrual_rule_id, work_hour_type_id)
  values
    (seed_tenant_id, null, seed_group_id, '00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-00000000a001'),
    (seed_tenant_id, null, seed_group_id, '00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-00000000a002'),
    (seed_tenant_id, null, seed_group_id, '00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-00000000a003')
  on conflict (accrual_rule_id, work_hour_type_id) do nothing;

  if actor_id is not null then
    insert into public.employment_work_hour_entries (id, tenant_id, administration_id, employee_id, employment_id, hr_group_id, work_hour_type_id, work_date, entry_granularity, subject_period_start, subject_period_end, posting_period_start, hours, status, source_type, source_key, note, approved_at, approved_by, created_by)
    select seed.entry_id, seed_tenant_id, employment.administration_id, employment.employee_id, employment.id, seed_group_id, seed.type_id, seed.work_date, 'DAY', seed.work_date, seed.work_date + 1, date_trunc('month', seed.work_date)::date, seed.hours, 'APPROVED', 'ACTUAL_WORK_FIXTURE', seed.entry_id::text, seed.note, timezone('utc', now()), actor_id, actor_id
    from (values
      ('00000000-0000-0000-0000-00000000c001'::uuid, 'b7391845-77d4-407c-bfe6-555a8a3d463b'::uuid, '00000000-0000-0000-0000-00000000a001'::uuid, '2026-09-08'::date, 8.0000::numeric, 'Fixture Lisa werkdag'),
      ('00000000-0000-0000-0000-00000000c002'::uuid, 'b058d882-47a9-43ff-853e-0e05237214af'::uuid, '00000000-0000-0000-0000-00000000a001'::uuid, '2026-09-29'::date, 8.0000::numeric, 'Fixture Jan voor roosterwissel'),
      ('00000000-0000-0000-0000-00000000c003'::uuid, 'b058d882-47a9-43ff-853e-0e05237214af'::uuid, '00000000-0000-0000-0000-00000000a001'::uuid, '2026-10-02'::date, 8.0000::numeric, 'Fixture Jan na roosterwissel'),
      ('00000000-0000-0000-0000-00000000c004'::uuid, 'b058d882-47a9-43ff-853e-0e05237214af'::uuid, '00000000-0000-0000-0000-00000000a002'::uuid, '2026-10-05'::date, 2.0000::numeric, 'Fixture Jan aanvullende deeltijduren'),
      ('00000000-0000-0000-0000-00000000c005'::uuid, 'b7391845-77d4-407c-bfe6-555a8a3d463b'::uuid, '00000000-0000-0000-0000-00000000a003'::uuid, '2026-09-09'::date, 2.0000::numeric, 'Fixture Lisa overwerk')
    ) as seed(entry_id, employment_id, type_id, work_date, hours, note)
    join public.employments employment on employment.id = seed.employment_id and employment.tenant_id = seed_tenant_id and employment.hr_group_id = seed_group_id
    on conflict (id) do nothing;

    insert into public.actual_work_revisions (tenant_id, hr_group_id, administration_id, employee_id, employment_id, entry_id, revision_number, operation, subject_period_start, subject_period_end, posting_period_start, previous_hours, current_hours, delta_hours, actor_user_id)
    select entry.tenant_id, entry.hr_group_id, entry.administration_id, entry.employee_id, entry.employment_id, entry.id, 1, 'CREATE', entry.subject_period_start, entry.subject_period_end, entry.posting_period_start, null, entry.hours, entry.hours, actor_id
    from public.employment_work_hour_entries entry
    where entry.tenant_id = seed_tenant_id and entry.hr_group_id = seed_group_id and entry.source_type = 'ACTUAL_WORK_FIXTURE'
      and not exists (select 1 from public.actual_work_revisions revision where revision.entry_id = entry.id);
  end if;
end;
$$;

commit;
