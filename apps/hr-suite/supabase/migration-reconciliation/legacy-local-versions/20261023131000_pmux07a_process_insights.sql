begin;

create index if not exists process_instances_report_started_at_idx
  on public.process_instances (tenant_id, hr_group_id, started_at)
  where started_at is not null;
create index if not exists process_instances_report_completed_at_idx
  on public.process_instances (tenant_id, hr_group_id, completed_at)
  where completed_at is not null;
create index if not exists process_steps_report_activated_at_idx
  on public.process_step_instances (tenant_id, hr_group_id, activated_at)
  where activated_at is not null;
create index if not exists process_steps_report_completed_at_idx
  on public.process_step_instances (tenant_id, hr_group_id, completed_at)
  where completed_at is not null;

-- Aggregate existing immutable process versions and runtime timestamps for the
-- Insights workspace. The projection intentionally omits employee and form data.
create or replace function internal_security.get_process_insights_projection(
  requested_hr_group_id uuid,
  requested_from_date date,
  requested_to_date date,
  requested_process_definition_id uuid,
  requested_page integer,
  requested_page_size integer,
  requested_language text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_value jsonb;
  normalized_language text := coalesce(requested_language, 'nl');
  row_offset integer;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if requested_hr_group_id is null
    or requested_from_date is null
    or requested_to_date is null
    or requested_from_date > requested_to_date
    or requested_to_date - requested_from_date > 365
    or requested_page is null or requested_page not between 1 and 10000
    or requested_page_size is null or requested_page_size not between 1 and 50
    or normalized_language not in ('nl', 'en') then
    raise exception 'PROCESS_INSIGHTS_FILTER_INVALID' using errcode = '22023';
  end if;
  row_offset := (requested_page - 1) * requested_page_size;

  with candidate_instances as materialized (
    select distinct
      instance.id,
      instance.tenant_id,
      instance.hr_group_id,
      instance.scope_type,
      instance.administration_id
    from public.process_instances instance
    join public.hr_groups group_row
      on group_row.tenant_id = instance.tenant_id
     and group_row.id = instance.hr_group_id
    where instance.hr_group_id = requested_hr_group_id
      and internal_security.process_scope_has_permission(
        instance.tenant_id,
        instance.hr_group_id,
        instance.scope_type,
        instance.administration_id,
        'process-operations:read'
      )
      and (
        exists (
          select 1
          from public.process_events event
          where event.tenant_id = instance.tenant_id
            and event.hr_group_id = instance.hr_group_id
            and event.process_instance_id = instance.id
            and event.event_type in ('PROCESS_STARTED', 'PROCESS_TERMINAL')
            and event.created_at >= (requested_from_date::timestamp at time zone group_row.time_zone)
            and event.created_at < ((requested_to_date + 1)::timestamp at time zone group_row.time_zone)
        )
        or exists (
          select 1
          from public.process_step_instances step
          where step.tenant_id = instance.tenant_id
            and step.hr_group_id = instance.hr_group_id
            and step.process_instance_id = instance.id
            and (
              (step.activated_at >= (requested_from_date::timestamp at time zone group_row.time_zone)
                and step.activated_at < ((requested_to_date + 1)::timestamp at time zone group_row.time_zone))
              or (step.completed_at >= (requested_from_date::timestamp at time zone group_row.time_zone)
                and step.completed_at < ((requested_to_date + 1)::timestamp at time zone group_row.time_zone))
            )
        )
      )
  ),
  scoped_instances as materialized (
    select
      instance.id,
      instance.tenant_id,
      instance.hr_group_id,
      instance.scope_type,
      instance.administration_id,
      instance.process_definition_id,
      instance.process_version_id,
      instance.status,
      instance.started_at,
      instance.completed_at,
      group_row.time_zone,
      definition.title as current_process_title,
      coalesce(internal_security.process_definition_content(version.definition_json) -> 'title', definition.title) as version_process_title,
      version.version_number,
      version.definition_json
    from candidate_instances candidate
    join public.process_instances instance
      on instance.tenant_id = candidate.tenant_id
     and instance.hr_group_id = candidate.hr_group_id
     and instance.id = candidate.id
    join public.hr_groups group_row
      on group_row.tenant_id = instance.tenant_id
     and group_row.id = instance.hr_group_id
    join public.process_definitions definition
      on definition.tenant_id = instance.tenant_id
     and definition.hr_group_id = instance.hr_group_id
     and definition.id = instance.process_definition_id
    join public.process_versions version
      on version.tenant_id = instance.tenant_id
     and version.hr_group_id = instance.hr_group_id
     and version.process_definition_id = instance.process_definition_id
     and version.id = instance.process_version_id
    where instance.hr_group_id = requested_hr_group_id
      and internal_security.process_scope_has_permission(
        instance.tenant_id,
        instance.hr_group_id,
        instance.scope_type,
        instance.administration_id,
        'process-operations:read'
      )
  ),
  event_facts as (
    select
      instance.id as process_instance_id,
      coalesce(bool_or(event.event_type = 'PROCESS_STARTED'), false) as started_in_period,
      coalesce(bool_or(event.event_type = 'PROCESS_TERMINAL' and event.payload ->> 'outcome' = 'COMPLETED'), false) as completed_in_period,
      coalesce(bool_or(event.event_type = 'PROCESS_TERMINAL' and event.payload ->> 'outcome' = 'REJECTED'), false) as rejected_in_period,
      coalesce(bool_or(event.event_type = 'PROCESS_TERMINAL' and event.payload ->> 'outcome' = 'CANCELLED'), false) as cancelled_in_period
    from scoped_instances instance
    join public.process_events event
      on event.tenant_id = instance.tenant_id
     and event.hr_group_id = instance.hr_group_id
     and event.process_instance_id = instance.id
     and event.event_type in ('PROCESS_STARTED', 'PROCESS_TERMINAL')
     and event.created_at >= (requested_from_date::timestamp at time zone instance.time_zone)
     and event.created_at < ((requested_to_date + 1)::timestamp at time zone instance.time_zone)
    group by instance.id
  ),
  step_facts as (
    select
      instance.id as process_instance_id,
      instance.process_definition_id,
      instance.process_version_id,
      instance.version_number,
      instance.time_zone,
      step.id as step_instance_id,
      step.step_key,
      step.status,
      step.activated_at,
      step.deadline_at,
      step.completed_at,
      claim.has_work_item,
      internal_security.process_localized_text(
        step_definition.value -> 'title', normalized_language, step.step_key
      ) as step_title,
      claim.first_claimed_at
    from scoped_instances instance
    join public.process_step_instances step
      on step.tenant_id = instance.tenant_id
     and step.hr_group_id = instance.hr_group_id
     and step.process_instance_id = instance.id
     and step.process_version_id = instance.process_version_id
    left join lateral (
      select definition_step.value
      from pg_catalog.jsonb_array_elements(
        coalesce(internal_security.process_definition_content(instance.definition_json) -> 'steps', '[]'::jsonb)
      ) as definition_step(value)
      where definition_step.value ->> 'key' = step.step_key
      limit 1
    ) step_definition on true
    left join lateral (
      select
        coalesce(pg_catalog.bool_or(item.id is not null), false) as has_work_item,
        min(event.created_at) as first_claimed_at
      from public.process_work_items item
      left join public.process_events event
        on event.tenant_id = item.tenant_id
       and event.hr_group_id = item.hr_group_id
       and event.process_instance_id = item.process_instance_id
       and event.work_item_id = item.id
       and event.event_type = 'WORK_ITEM_CLAIMED'
      where item.tenant_id = step.tenant_id
        and item.hr_group_id = step.hr_group_id
        and item.process_instance_id = step.process_instance_id
        and item.process_version_id = instance.process_version_id
        and item.step_instance_id = step.id
    ) claim on true
    where (step.activated_at >= (requested_from_date::timestamp at time zone instance.time_zone)
        and step.activated_at < ((requested_to_date + 1)::timestamp at time zone instance.time_zone))
       or (step.completed_at >= (requested_from_date::timestamp at time zone instance.time_zone)
        and step.completed_at < ((requested_to_date + 1)::timestamp at time zone instance.time_zone))
  ),
  period_instances as (
    select
      instance.*,
      coalesce(event.started_in_period, false) as started_in_period,
      coalesce(event.completed_in_period, false) as completed_in_period,
      coalesce(event.rejected_in_period, false) as rejected_in_period,
      coalesce(event.cancelled_in_period, false) as cancelled_in_period
    from scoped_instances instance
    left join event_facts event on event.process_instance_id = instance.id
    where coalesce(event.started_in_period, false)
       or coalesce(event.completed_in_period, false)
       or coalesce(event.rejected_in_period, false)
       or coalesce(event.cancelled_in_period, false)
       or exists (select 1 from step_facts step where step.process_instance_id = instance.id)
  ),
  filtered_instances as (
    select * from period_instances
    where requested_process_definition_id is null
       or process_definition_id = requested_process_definition_id
  ),
  filtered_steps as (
    select step.*
    from step_facts step
    join scoped_instances instance on instance.id = step.process_instance_id
    where requested_process_definition_id is null
       or instance.process_definition_id = requested_process_definition_id
  ),
  completed_durations as (
    select
      instance.id as process_instance_id,
      instance.process_definition_id,
      instance.process_version_id,
      extract(epoch from (instance.completed_at - instance.started_at))::numeric as elapsed_seconds
    from filtered_instances instance
    where instance.status = 'COMPLETED'::public.process_instance_status
      and instance.completed_in_period
      and instance.started_at is not null
      and instance.completed_at >= instance.started_at
  ),
  sla_summary as (
    select
      count(*) filter (where step.status = 'COMPLETED'::public.process_step_instance_status and step.deadline_at is not null) as denominator,
      count(*) filter (where step.status = 'COMPLETED'::public.process_step_instance_status and step.deadline_at is not null and step.completed_at <= step.deadline_at) as within_sla,
      count(*) filter (where step.status = 'COMPLETED'::public.process_step_instance_status and step.deadline_at is not null and step.completed_at > step.deadline_at) as outside_sla
    from filtered_steps step
  ),
  process_sla as (
    select
      instance.process_definition_id,
      instance.process_version_id,
      count(*) filter (where step.status = 'COMPLETED'::public.process_step_instance_status and step.deadline_at is not null) as denominator,
      count(*) filter (where step.status = 'COMPLETED'::public.process_step_instance_status and step.deadline_at is not null and step.completed_at <= step.deadline_at) as within_sla,
      count(*) filter (where step.status = 'COMPLETED'::public.process_step_instance_status and step.deadline_at is not null and step.completed_at > step.deadline_at) as outside_sla
    from filtered_instances instance
    join filtered_steps step on step.process_instance_id = instance.id
    group by instance.process_definition_id, instance.process_version_id
  ),
  process_groups as (
    select
      instance.process_definition_id,
      instance.process_version_id,
      pg_catalog.max(internal_security.process_localized_text(instance.version_process_title, normalized_language, '')) as process_title,
      instance.version_number,
      count(*) filter (where instance.started_in_period) as started_count,
      count(*) filter (where instance.completed_in_period and instance.status = 'COMPLETED'::public.process_instance_status) as completed_count,
      count(*) filter (where instance.started_in_period and instance.status in ('RUNNING'::public.process_instance_status, 'WAITING'::public.process_instance_status, 'BLOCKED'::public.process_instance_status)) as running_count,
      count(*) filter (where instance.rejected_in_period) as rejected_count,
      count(*) filter (where instance.cancelled_in_period) as cancelled_count,
      pg_catalog.round(pg_catalog.avg(duration.elapsed_seconds))::bigint as average_lead_seconds,
      pg_catalog.round(pg_catalog.percentile_cont(0.5) within group (order by duration.elapsed_seconds::double precision))::bigint as median_lead_seconds,
      (select item.id
       from public.process_work_items item
       join filtered_instances sample
         on sample.id = item.process_instance_id
        and sample.process_definition_id = instance.process_definition_id
        and sample.process_version_id = instance.process_version_id
       order by item.updated_at desc, item.id
       limit 1) as sample_work_item_id
    from filtered_instances instance
    left join completed_durations duration
      on duration.process_instance_id = instance.id
    group by instance.process_definition_id, instance.process_version_id, instance.version_number
  ),
  process_page as (
    select
      groups.*,
      coalesce(sla.denominator, 0) as sla_denominator,
      coalesce(sla.within_sla, 0) as sla_within,
      coalesce(sla.outside_sla, 0) as sla_outside
    from process_groups groups
    left join process_sla sla
      on sla.process_definition_id = groups.process_definition_id
     and sla.process_version_id = groups.process_version_id
    order by groups.process_title, groups.version_number desc
    limit requested_page_size offset row_offset
  ),
  step_groups as (
    select
      instance.process_definition_id,
      instance.process_version_id,
      instance.version_number,
      pg_catalog.max(internal_security.process_localized_text(instance.version_process_title, normalized_language, '')) as process_title,
      step.step_key,
      pg_catalog.max(step.step_title) as step_title,
      count(*) filter (where step.has_work_item and step.first_claimed_at >= step.activated_at and step.activated_at is not null) as wait_sample_count,
      count(*) filter (where step.has_work_item and step.first_claimed_at is null and step.status in ('ACTIVE'::public.process_step_instance_status, 'BLOCKED'::public.process_step_instance_status)) as awaiting_first_claim_count,
      pg_catalog.round(pg_catalog.avg(extract(epoch from (step.first_claimed_at - step.activated_at))) filter (where step.has_work_item and step.first_claimed_at >= step.activated_at and step.activated_at is not null))::bigint as average_wait_seconds,
      pg_catalog.round(pg_catalog.percentile_cont(0.5) within group (order by extract(epoch from (step.first_claimed_at - step.activated_at))::double precision) filter (where step.has_work_item and step.first_claimed_at >= step.activated_at and step.activated_at is not null))::bigint as median_wait_seconds,
      count(*) filter (where step.status = 'COMPLETED'::public.process_step_instance_status and step.deadline_at is not null) as sla_denominator,
      count(*) filter (where step.status = 'COMPLETED'::public.process_step_instance_status and step.deadline_at is not null and step.completed_at <= step.deadline_at) as sla_within,
      count(*) filter (where step.status = 'COMPLETED'::public.process_step_instance_status and step.deadline_at is not null and step.completed_at > step.deadline_at) as sla_outside
    from filtered_steps step
    join filtered_instances instance on instance.id = step.process_instance_id
    group by instance.process_definition_id, instance.process_version_id, instance.version_number, step.step_key
  ),
  step_page as (
    select *
    from step_groups
    order by average_wait_seconds desc nulls last, wait_sample_count desc, step_title
    limit requested_page_size offset row_offset
  ),
  process_options as (
    select distinct option_row.id, option_row.title
    from (
      select
        instance.process_definition_id as id,
        internal_security.process_localized_text(instance.current_process_title, normalized_language, '') as title
      from period_instances instance
      union all
      select
        definition.id,
        internal_security.process_localized_text(definition.title, normalized_language, definition.key)
      from public.process_definitions definition
      where definition.id = requested_process_definition_id
        and definition.hr_group_id = requested_hr_group_id
        and internal_security.process_scope_has_permission(
          definition.tenant_id,
          definition.hr_group_id,
          definition.scope_type,
          definition.administration_id,
          'process-operations:read'
        )
    ) option_row
    order by option_row.title
  )
  select pg_catalog.jsonb_build_object(
    'fromDate', requested_from_date,
    'toDate', requested_to_date,
    'generatedAt', pg_catalog.timezone('utc', pg_catalog.now()),
    'summary', (
      select pg_catalog.jsonb_build_object(
        'started', count(*) filter (where instance.started_in_period),
        'completed', count(*) filter (where instance.completed_in_period and instance.status = 'COMPLETED'::public.process_instance_status),
        'runningNow', count(*) filter (where instance.started_in_period and instance.status in ('RUNNING'::public.process_instance_status, 'WAITING'::public.process_instance_status, 'BLOCKED'::public.process_instance_status)),
        'rejected', count(*) filter (where instance.rejected_in_period),
        'cancelled', count(*) filter (where instance.cancelled_in_period),
        'averageLeadSeconds', (select pg_catalog.round(pg_catalog.avg(elapsed_seconds))::bigint from completed_durations),
        'medianLeadSeconds', (select pg_catalog.round(pg_catalog.percentile_cont(0.5) within group (order by elapsed_seconds::double precision))::bigint from completed_durations),
        'slaDenominator', (select denominator from sla_summary),
        'slaWithin', (select within_sla from sla_summary),
        'slaOutside', (select outside_sla from sla_summary)
      )
      from filtered_instances instance
    ),
    'processTotal', (select count(*) from process_groups),
    'processes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'processDefinitionId', row.process_definition_id,
        'processTitle', row.process_title,
        'versionNumber', row.version_number,
        'started', row.started_count,
        'completed', row.completed_count,
        'runningNow', row.running_count,
        'rejected', row.rejected_count,
        'cancelled', row.cancelled_count,
        'averageLeadSeconds', row.average_lead_seconds,
        'medianLeadSeconds', row.median_lead_seconds,
        'slaDenominator', row.sla_denominator,
        'slaWithin', row.sla_within,
        'slaOutside', row.sla_outside,
        'sampleWorkItemId', row.sample_work_item_id
      ) order by row.process_title, row.version_number desc)
      from process_page row
    ), '[]'::jsonb),
    'stepTotal', (select count(*) from step_groups),
    'steps', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'processTitle', row.process_title,
        'versionNumber', row.version_number,
        'stepTitle', row.step_title,
        'waitSampleCount', row.wait_sample_count,
        'awaitingFirstClaimCount', row.awaiting_first_claim_count,
        'averageWaitSeconds', row.average_wait_seconds,
        'medianWaitSeconds', row.median_wait_seconds,
        'slaDenominator', row.sla_denominator,
        'slaWithin', row.sla_within,
        'slaOutside', row.sla_outside
      ) order by row.average_wait_seconds desc nulls last, row.wait_sample_count desc, row.step_title)
      from step_page row
    ), '[]'::jsonb),
    'processOptions', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', option.id, 'title', option.title) order by option.title)
      from process_options option
    ), '[]'::jsonb),
    'page', requested_page,
    'pageSize', requested_page_size
  ) into result_value;

  return result_value;
end;
$$;

revoke all on function internal_security.get_process_insights_projection(uuid, date, date, uuid, integer, integer, text)
  from public, anon, authenticated;

create or replace function public.get_process_insights_projection(
  requested_hr_group_id uuid,
  requested_from_date date,
  requested_to_date date,
  requested_process_definition_id uuid,
  requested_page integer,
  requested_page_size integer,
  requested_language text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.get_process_insights_projection(
    requested_hr_group_id,
    requested_from_date,
    requested_to_date,
    requested_process_definition_id,
    requested_page,
    requested_page_size,
    requested_language
  );
$$;

revoke all on function public.get_process_insights_projection(uuid, date, date, uuid, integer, integer, text)
  from public, anon;
grant execute on function public.get_process_insights_projection(uuid, date, date, uuid, integer, integer, text)
  to authenticated;

commit;
