begin;

-- PMUX-03A LOCAL ONLY: this additive catalog RPC must not be applied to a
-- remote Supabase environment without separate authorization.
create or replace function internal_security.get_process_startable_catalog_internal(
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_employee_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if requested_tenant_id is null or requested_hr_group_id is null then
    raise exception 'PROCESS_START_CATALOG_SCOPE_REQUIRED' using errcode = '42501';
  end if;

  actor_employee_id := internal_security.current_employee_id(requested_tenant_id, requested_hr_group_id);
  if actor_employee_id is null or not exists (
    select 1
    from public.employees employee
    where employee.tenant_id = requested_tenant_id
      and employee.hr_group_id = requested_hr_group_id
      and employee.id = actor_employee_id
      and employee.auth_user_id = auth.uid()
      and employee.deleted_at is null
      and employee.is_active
  ) then
    raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'processDefinitionId', definition.id,
        'title', published.content -> 'title',
        'description', published.content -> 'description',
        'steps', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'title', step.value -> 'title',
              'responsibleRole', participant.label,
              'isStart', step.value ->> 'key' = published.content ->> 'startStepKey'
            )
            order by reachable.minimum_depth nulls last, step.value ->> 'key'
          ), '[]'::jsonb)
          from pg_catalog.jsonb_array_elements(published.content -> 'steps') as step(value)
          left join lateral (
            select participant_row.value -> 'label' as label
            from pg_catalog.jsonb_array_elements(published.content -> 'participants') as participant_row(value)
            where participant_row.value ->> 'key' = step.value ->> 'participantKey'
            limit 1
          ) participant on true
          left join lateral (
            with recursive path_walk(step_key, visited, depth) as (
              select published.content ->> 'startStepKey',
                array[published.content ->> 'startStepKey']::text[], 0
              union all
              select transition.value ->> 'toStepKey',
                path_walk.visited || (transition.value ->> 'toStepKey'),
                path_walk.depth + 1
              from path_walk
              cross join lateral pg_catalog.jsonb_array_elements(published.content -> 'transitions') as transition(value)
              where transition.value ->> 'fromStepKey' = path_walk.step_key
                and path_walk.depth < 64
                and not (transition.value ->> 'toStepKey' = any(path_walk.visited))
            )
            select min(path_walk.depth) as minimum_depth
            from path_walk
            where path_walk.step_key = step.value ->> 'key'
          ) reachable on true
        ),
        'routes', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'fromTitle', from_step.value -> 'title',
              'label', transition.value -> 'label',
              'toTitle', to_step.value -> 'title'
            )
            order by from_step.value ->> 'key', transition.value ->> 'key'
          ), '[]'::jsonb)
          from pg_catalog.jsonb_array_elements(published.content -> 'transitions') as transition(value)
          join pg_catalog.jsonb_array_elements(published.content -> 'steps') as from_step(value)
            on from_step.value ->> 'key' = transition.value ->> 'fromStepKey'
          join pg_catalog.jsonb_array_elements(published.content -> 'steps') as to_step(value)
            on to_step.value ->> 'key' = transition.value ->> 'toStepKey'
        )
      )
      order by published.content -> 'title' ->> 'nl', definition.id
    ), '[]'::jsonb)
    from public.process_definitions definition
    join lateral (
      select version.definition_json
      from public.process_versions version
      where version.tenant_id = definition.tenant_id
        and version.hr_group_id = definition.hr_group_id
        and version.process_definition_id = definition.id
      order by version.version_number desc
      limit 1
    ) version on true
    cross join lateral (
      select internal_security.process_definition_content(version.definition_json) as content
    ) published
    where definition.tenant_id = requested_tenant_id
      and definition.hr_group_id = requested_hr_group_id
      and definition.status = 'PUBLISHED'::public.process_definition_status
      and definition.key not in ('internal-transfer', 'document-acknowledgement', 'leave-request')
      and not exists (
        select 1
        from public.process_recipe_activations activation
        join public.process_recipe_catalog recipe
          on recipe.id = activation.process_recipe_id
        where activation.tenant_id = definition.tenant_id
          and activation.hr_group_id = definition.hr_group_id
          and activation.process_definition_id = definition.id
          and recipe.recipe_key in ('internal-transfer', 'document-acknowledgement', 'leave-request')
      )
      and (
        internal_security.process_scope_has_permission(
          definition.tenant_id, definition.hr_group_id, definition.scope_type,
          definition.administration_id, 'process-instance:start'
        )
        or (
          actor_employee_id = internal_security.current_employee_id(definition.tenant_id, definition.hr_group_id)
          and internal_security.process_scope_has_permission(
            definition.tenant_id, definition.hr_group_id, definition.scope_type,
            definition.administration_id, 'self:process-instance:start'
          )
        )
      )
      and (
        definition.scope_type = 'TENANT'::public.access_scope_type
        or exists (
          select 1
          from public.employments employment
          where employment.tenant_id = definition.tenant_id
            and employment.hr_group_id = definition.hr_group_id
            and employment.administration_id = definition.administration_id
            and employment.employee_id = actor_employee_id
            and employment.deleted_at is null
            and employment.starts_on <= current_date
            and (employment.ends_on is null or employment.ends_on >= current_date)
        )
      )
  ), '[]'::jsonb);
end;
$$;

revoke all on function internal_security.get_process_startable_catalog_internal(uuid, uuid)
  from public, anon, authenticated;
grant execute on function internal_security.get_process_startable_catalog_internal(uuid, uuid)
  to authenticated;

create or replace function public.get_process_startable_catalog(
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.get_process_startable_catalog_internal(
    requested_tenant_id, requested_hr_group_id
  );
$$;

revoke all on function public.get_process_startable_catalog(uuid, uuid) from public, anon;
grant execute on function public.get_process_startable_catalog(uuid, uuid) to authenticated;

commit;
