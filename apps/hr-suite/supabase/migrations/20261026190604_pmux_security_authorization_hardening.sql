-- PMUX authorization hardening. Candidate rows remain immutable routing snapshots;
-- every read and action rechecks current permission and subject scope.
begin;

create or replace function internal_security.process_user_has_scoped_permission(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_scope_type public.access_scope_type,
  requested_administration_id uuid,
  requested_actor_user_id uuid,
  requested_permission_code text,
  requested_role_codes text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select requested_actor_user_id is not null
    and requested_permission_code is not null
    and exists (
      select 1
      from public.user_access access
      join public.management_roles role
        on role.id = access.management_role_id
       and (role.tenant_id is null or role.tenant_id = requested_tenant_id)
       and role.is_active
       and role.deleted_at is null
      join public.role_permissions role_permission
        on role_permission.management_role_id = role.id
      join public.permissions permission
        on permission.id = role_permission.permission_id
       and permission.code = requested_permission_code
      where access.user_id = requested_actor_user_id
        and access.tenant_id = requested_tenant_id
        and access.is_active
        and (requested_role_codes is null or role.code = any(requested_role_codes))
        and (
          (
            requested_scope_type = 'TENANT'::public.access_scope_type
            and requested_administration_id is null
            and (
              access.scope_type = 'TENANT'::public.access_scope_type
              or (
                requested_permission_code like 'self:%'
                and access.scope_type = 'ADMINISTRATION'::public.access_scope_type
                and exists (
                  select 1
                  from public.administrations administration
                  where administration.tenant_id = requested_tenant_id
                    and administration.hr_group_id = requested_hr_group_id
                    and administration.id = access.administration_id
                    and administration.is_active
                )
              )
            )
          )
          or
          (
            requested_scope_type = 'ADMINISTRATION'::public.access_scope_type
            and requested_administration_id is not null
            and exists (
              select 1
              from public.administrations administration
              where administration.tenant_id = requested_tenant_id
                and administration.hr_group_id = requested_hr_group_id
                and administration.id = requested_administration_id
                and administration.is_active
            )
            and (
              access.scope_type = 'TENANT'::public.access_scope_type
              or (
                access.scope_type = 'ADMINISTRATION'::public.access_scope_type
                and access.administration_id = requested_administration_id
              )
            )
          )
        )
    );
$$;

create or replace function internal_security.process_manager_has_subject_permission(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_subject_employee_id uuid,
  requested_actor_user_id uuid,
  requested_actor_employee_id uuid,
  requested_permission_code text,
  requested_as_of_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive target_placements as (
    select organization.tenant_id,
           organization.hr_group_id,
           organization.administration_id,
           organization.department_id
    from public.employee_organizations organization
    where organization.tenant_id = requested_tenant_id
      and organization.hr_group_id = requested_hr_group_id
      and organization.employee_id = requested_subject_employee_id
      and (requested_administration_id is null or organization.administration_id = requested_administration_id)
      and organization.effective_from <= requested_as_of_date
      and (organization.effective_to is null or organization.effective_to >= requested_as_of_date)
  ), target_departments as (
    select department.id, department.parent_id, placement.tenant_id, placement.hr_group_id
    from target_placements placement
    join public.departments department
      on department.tenant_id = placement.tenant_id
     and department.hr_group_id = placement.hr_group_id
     and department.id = placement.department_id
     and department.is_active
    union
    select parent.id, parent.parent_id, child.tenant_id, child.hr_group_id
    from target_departments child
    join public.departments parent
      on parent.tenant_id = child.tenant_id
     and parent.hr_group_id = child.hr_group_id
     and parent.id = child.parent_id
     and parent.is_active
  ), actor as (
    select employee.id
    from public.employees employee
    where employee.tenant_id = requested_tenant_id
      and employee.hr_group_id = requested_hr_group_id
      and employee.id = requested_actor_employee_id
      and employee.auth_user_id = requested_actor_user_id
      and employee.is_active
      and employee.deleted_at is null
      and requested_actor_employee_id <> requested_subject_employee_id
  )
  select requested_permission_code is not null
    and requested_permission_code not like 'self:%'
    and exists (
      select 1
      from actor
      join target_placements placement on true
      join public.employee_organizations organization
        on organization.tenant_id = placement.tenant_id
       and organization.hr_group_id = placement.hr_group_id
       and organization.administration_id = placement.administration_id
       and organization.employee_id = requested_subject_employee_id
       and organization.department_id = placement.department_id
       and organization.effective_from <= requested_as_of_date
       and (organization.effective_to is null or organization.effective_to >= requested_as_of_date)
      join public.management_roles role
        on role.code = 'DIRECT_MANAGER'
       and role.tenant_id is null
       and role.is_active
       and role.deleted_at is null
      join public.role_permissions role_permission
        on role_permission.management_role_id = role.id
      join public.permissions permission
        on permission.id = role_permission.permission_id
       and permission.code = requested_permission_code
      where organization.direct_manager_id = actor.id
    )
    or (
      requested_permission_code is not null
      and requested_permission_code not like 'self:%'
      and exists (
        select 1
        from actor
        join public.department_management assignment
          on assignment.tenant_id = requested_tenant_id
         and assignment.hr_group_id = requested_hr_group_id
         and assignment.employee_id = actor.id
         and assignment.department_id is not null
         and assignment.effective_from <= requested_as_of_date
         and (assignment.effective_to is null or assignment.effective_to >= requested_as_of_date)
        join target_departments department
          on department.tenant_id = assignment.tenant_id
         and department.hr_group_id = assignment.hr_group_id
         and department.id = assignment.department_id
        join public.management_roles role
          on role.id = assignment.management_role_id
         and (role.tenant_id is null or role.tenant_id = requested_tenant_id)
         and role.is_active
         and role.deleted_at is null
        join public.role_permissions role_permission
          on role_permission.management_role_id = role.id
        join public.permissions permission
          on permission.id = role_permission.permission_id
         and permission.code = requested_permission_code
      )
    );
$$;

create or replace function internal_security.process_subject_actor_has_permission(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_scope_type public.access_scope_type,
  requested_administration_id uuid,
  requested_subject_employee_id uuid,
  requested_actor_user_id uuid,
  requested_actor_employee_id uuid,
  requested_permission_code text,
  requested_as_of_date date
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_employee_id uuid := requested_actor_employee_id;
  self_permission_code text;
begin
  if requested_actor_user_id is null or requested_permission_code is null then return false; end if;

  if requested_permission_code not like 'self:%'
    and internal_security.process_user_has_scoped_permission(
      requested_tenant_id, requested_hr_group_id, requested_scope_type,
      requested_administration_id, requested_actor_user_id, requested_permission_code,
      array['TENANT_ADMIN', 'HR_ADMIN']::text[]
    ) then
    return true;
  end if;

  if actor_employee_id is null then
    select employee.id into actor_employee_id
    from public.employees employee
    where employee.tenant_id = requested_tenant_id
      and employee.hr_group_id = requested_hr_group_id
      and employee.auth_user_id = requested_actor_user_id
      and employee.is_active
      and employee.deleted_at is null
    order by employee.created_at, employee.id
    limit 1;
  end if;

  if requested_subject_employee_id is null or actor_employee_id is null then return false; end if;
  self_permission_code := case
    when requested_permission_code like 'self:%' then requested_permission_code
    else 'self:' || requested_permission_code
  end;

  if actor_employee_id = requested_subject_employee_id
    and internal_security.process_user_has_scoped_permission(
      requested_tenant_id, requested_hr_group_id, requested_scope_type,
      requested_administration_id, requested_actor_user_id, self_permission_code, null
    ) then
    return true;
  end if;

  if requested_permission_code like 'self:%' then return false; end if;

  return internal_security.process_manager_has_subject_permission(
    requested_tenant_id, requested_hr_group_id, requested_administration_id,
    requested_subject_employee_id, requested_actor_user_id, actor_employee_id,
    requested_permission_code, requested_as_of_date
  );
end;
$$;

create or replace function internal_security.process_instance_user_has_permission(
  requested_process_instance_id uuid,
  requested_actor_user_id uuid,
  requested_permission_code text,
  requested_as_of_date date default current_date
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  instance_row public.process_instances%rowtype;
  actor_employee_id uuid;
  subject_scope record;
  subject_count integer := 0;
begin
  if requested_actor_user_id is null then return false; end if;
  select instance.* into instance_row
  from public.process_instances instance
  where instance.id = requested_process_instance_id;
  if instance_row.id is null then return false; end if;

  select employee.id into actor_employee_id
  from public.employees employee
  where employee.tenant_id = instance_row.tenant_id
    and employee.hr_group_id = instance_row.hr_group_id
    and employee.auth_user_id = requested_actor_user_id
    and employee.is_active
    and employee.deleted_at is null
  order by employee.created_at, employee.id
  limit 1;

  for subject_scope in
    select distinct subjects.employee_id, subjects.scope_type, subjects.administration_id
    from (
      select subject.employee_id, instance_row.scope_type as scope_type,
             instance_row.administration_id
      from public.process_employee_subjects subject
      where subject.tenant_id = instance_row.tenant_id
        and subject.hr_group_id = instance_row.hr_group_id
        and subject.process_instance_id = instance_row.id
      union all
      select employment.employee_id,
             'ADMINISTRATION'::public.access_scope_type as scope_type,
             subject.administration_id
      from public.process_employment_subjects subject
      join public.employments employment
        on employment.tenant_id = subject.tenant_id
       and employment.hr_group_id = subject.hr_group_id
       and employment.administration_id = subject.administration_id
       and employment.id = subject.employment_id
      where subject.tenant_id = instance_row.tenant_id
        and subject.hr_group_id = instance_row.hr_group_id
        and subject.process_instance_id = instance_row.id
    ) subjects
    where subjects.employee_id is not null
  loop
    subject_count := subject_count + 1;
    if not internal_security.process_subject_actor_has_permission(
      instance_row.tenant_id, instance_row.hr_group_id, subject_scope.scope_type,
      subject_scope.administration_id, subject_scope.employee_id, requested_actor_user_id,
      actor_employee_id, requested_permission_code, coalesce(requested_as_of_date, current_date)
    ) then
      return false;
    end if;
  end loop;

  if subject_count > 0 then return true; end if;

  if requested_permission_code like 'process-instance:%'
    and actor_employee_id is not null
    and instance_row.initiator_employee_id = actor_employee_id
    and internal_security.process_subject_actor_has_permission(
      instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type,
      instance_row.administration_id, actor_employee_id, requested_actor_user_id,
      actor_employee_id, requested_permission_code, coalesce(requested_as_of_date, current_date)
    ) then
    return true;
  end if;

  return internal_security.process_subject_actor_has_permission(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type,
    instance_row.administration_id, null, requested_actor_user_id, actor_employee_id,
    requested_permission_code, coalesce(requested_as_of_date, current_date)
  );
end;
$$;

create or replace function internal_security.process_work_item_user_has_permission(
  requested_work_item_id uuid,
  requested_actor_user_id uuid,
  requested_actor_employee_id uuid,
  requested_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.process_work_items item
    join public.process_instances instance
      on instance.tenant_id = item.tenant_id
     and instance.hr_group_id = item.hr_group_id
     and instance.id = item.process_instance_id
    where item.id = requested_work_item_id
      and (
        requested_actor_employee_id is null
        or exists (
          select 1
          from public.employees actor
          where actor.tenant_id = instance.tenant_id
            and actor.hr_group_id = instance.hr_group_id
            and actor.id = requested_actor_employee_id
            and actor.auth_user_id = requested_actor_user_id
            and actor.is_active
            and actor.deleted_at is null
        )
      )
      and internal_security.process_instance_user_has_permission(
        instance.id, requested_actor_user_id, requested_permission_code, current_date
      )
  );
$$;

create or replace function internal_security.process_work_item_user_is_latest_candidate(
  requested_work_item_id uuid,
  requested_actor_user_id uuid,
  requested_actor_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select requested_actor_user_id is not null
    and requested_actor_employee_id is not null
    and exists (
      select 1
      from public.process_work_item_candidates candidate
      where candidate.work_item_id = requested_work_item_id
        and candidate.employee_id = requested_actor_employee_id
        and candidate.candidate_user_id = requested_actor_user_id
        and candidate.is_eligible
        and candidate.resolution_revision = (
          select max(latest.resolution_revision)
          from public.process_work_item_candidates latest
          where latest.tenant_id = candidate.tenant_id
            and latest.hr_group_id = candidate.hr_group_id
            and latest.work_item_id = candidate.work_item_id
        )
    );
$$;

revoke all on function internal_security.process_user_has_scoped_permission(uuid, uuid, public.access_scope_type, uuid, uuid, text, text[])
  from public, anon, authenticated;
revoke all on function internal_security.process_manager_has_subject_permission(uuid, uuid, uuid, uuid, uuid, uuid, text, date)
  from public, anon, authenticated;
revoke all on function internal_security.process_subject_actor_has_permission(uuid, uuid, public.access_scope_type, uuid, uuid, uuid, uuid, text, date)
  from public, anon, authenticated;
revoke all on function internal_security.process_instance_user_has_permission(uuid, uuid, text, date)
  from public, anon, authenticated;
revoke all on function internal_security.process_work_item_user_has_permission(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function internal_security.process_work_item_user_is_latest_candidate(uuid, uuid, uuid)
  from public, anon, authenticated;

create or replace function internal_security.process_instance_can_read(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_instance_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.process_instances instance
    where instance.tenant_id = requested_tenant_id
      and instance.hr_group_id = requested_hr_group_id
      and instance.id = requested_instance_id
      and internal_security.process_instance_user_has_permission(
        instance.id, auth.uid(), 'process-instance:read', current_date
      )
  );
$$;

revoke all on function internal_security.process_instance_can_read(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function internal_security.process_instance_can_read(uuid, uuid, uuid)
  to authenticated;

create or replace function internal_security.process_work_item_can_read(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_work_item_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.process_work_items item
    join public.process_instances instance
      on instance.tenant_id = item.tenant_id
     and instance.hr_group_id = item.hr_group_id
     and instance.id = item.process_instance_id
    where item.tenant_id = requested_tenant_id
      and item.hr_group_id = requested_hr_group_id
      and item.id = requested_work_item_id
      and (
        internal_security.process_instance_user_has_permission(
          instance.id, auth.uid(), 'process-task:read', current_date
        )
        or internal_security.process_instance_user_has_permission(
          instance.id, auth.uid(), 'process-instance:read', current_date
        )
      )
  );
$$;

revoke all on function internal_security.process_work_item_can_read(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function internal_security.process_work_item_can_read(uuid, uuid, uuid)
  to authenticated;

create or replace function internal_security.process_form_actor_allowed(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_instance_id uuid,
  requested_work_item_id uuid,
  requested_actor_user_id uuid,
  requested_actor_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employees actor
    join public.process_instances instance
      on instance.tenant_id = requested_tenant_id
     and instance.hr_group_id = requested_hr_group_id
     and instance.id = requested_instance_id
    join public.process_work_items item
      on item.tenant_id = instance.tenant_id
     and item.hr_group_id = instance.hr_group_id
     and item.process_instance_id = instance.id
     and item.id = requested_work_item_id
    where actor.tenant_id = requested_tenant_id
      and actor.hr_group_id = requested_hr_group_id
      and actor.id = requested_actor_employee_id
      and actor.auth_user_id = requested_actor_user_id
      and actor.is_active
      and actor.deleted_at is null
      and internal_security.process_work_item_user_has_permission(
        item.id, requested_actor_user_id, requested_actor_employee_id, 'process-task:act'
      )
  );
$$;

revoke all on function internal_security.process_form_actor_allowed(uuid, uuid, uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

create or replace function internal_security.resolve_process_assignment(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_scope_type public.access_scope_type,
  requested_administration_id uuid,
  requested_process_instance_id uuid,
  requested_process_version_id uuid,
  requested_participant jsonb,
  requested_subject_employee_id uuid,
  requested_initiator_employee_id uuid,
  requested_business_date date,
  requested_started_at timestamptz,
  requested_activated_at timestamptz,
  requested_fields jsonb,
  requested_actor_employee_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  selector jsonb := requested_participant -> 'selector';
  mode_name text := requested_participant ->> 'assignmentMode';
  policy_name text := selector ->> 'resolutionDatePolicy';
  as_of_date date;
  candidate_result jsonb;
  candidate jsonb;
  rejection jsonb;
  candidates jsonb := '[]'::jsonb;
  rejections jsonb := '[]'::jsonb;
  employee_id uuid;
  department_id uuid;
  direct_manager_id uuid;
  direct_manager_count integer;
  selected_value jsonb;
  role_depth integer;
  role_management_id uuid;
  role_code_value text;
  role_department_id uuid;
  resolve_department_id uuid;
  candidate_row record;
  source_name text := selector ->> 'type';
  rejected_candidates jsonb;
begin
  as_of_date := internal_security.process_assignment_date(
    selector, requested_fields, requested_started_at, requested_activated_at, requested_business_date
  );

  if selector ->> 'type' in ('EXPLICIT_PERSON', 'FORM_FIELD_PERSON') then
    selected_value := coalesce(requested_fields, '{}'::jsonb) -> (selector ->> 'personFieldKey');
    employee_id := coalesce(selected_value ->> 'id', selected_value #>> '{}')::uuid;
    candidate_result := internal_security.process_assignment_candidate(
      requested_tenant_id, requested_hr_group_id, requested_administration_id, as_of_date,
      employee_id, requested_actor_employee_id,
      (requested_participant ->> 'permission') like 'self:%',
      null, null, source_name, null, '[]'::jsonb
    );
    candidate := candidate_result -> 'candidate';
    rejection := candidate_result -> 'rejection';
    if candidate is not null and candidate <> 'null'::jsonb then candidates := candidates || jsonb_build_array(candidate); end if;
    if rejection is not null and rejection <> 'null'::jsonb then rejections := rejections || jsonb_build_array(rejection); end if;
  elsif selector ->> 'type' = 'INITIATOR' then
    candidate_result := internal_security.process_assignment_candidate(
      requested_tenant_id, requested_hr_group_id, requested_administration_id, as_of_date,
      requested_initiator_employee_id, requested_actor_employee_id,
      (requested_participant ->> 'permission') like 'self:%',
      null, null, source_name, null, '[]'::jsonb
    );
    candidate := candidate_result -> 'candidate'; rejection := candidate_result -> 'rejection';
    if candidate is not null and candidate <> 'null'::jsonb then candidates := candidates || jsonb_build_array(candidate); end if;
    if rejection is not null and rejection <> 'null'::jsonb then rejections := rejections || jsonb_build_array(rejection); end if;
  elsif selector ->> 'type' = 'SUBJECT_EMPLOYEE' then
    candidate_result := internal_security.process_assignment_candidate(
      requested_tenant_id, requested_hr_group_id, requested_administration_id, as_of_date,
      requested_subject_employee_id, requested_actor_employee_id,
      (requested_participant ->> 'permission') like 'self:%',
      null, null, source_name, null, '[]'::jsonb
    );
    candidate := candidate_result -> 'candidate'; rejection := candidate_result -> 'rejection';
    if candidate is not null and candidate <> 'null'::jsonb then candidates := candidates || jsonb_build_array(candidate); end if;
    if rejection is not null and rejection <> 'null'::jsonb then rejections := rejections || jsonb_build_array(rejection); end if;
  elsif selector ->> 'type' = 'DIRECT_MANAGER_OF_SUBJECT' then
    select count(*), min(organization.direct_manager_id)
      into direct_manager_count, direct_manager_id
    from public.employee_organizations organization
    where organization.tenant_id = requested_tenant_id
      and organization.hr_group_id = requested_hr_group_id
      and organization.employee_id = requested_subject_employee_id
      and organization.effective_from <= as_of_date
      and (organization.effective_to is null or organization.effective_to >= as_of_date);
    if direct_manager_count > 1 then raise exception 'AMBIGUOUS_ASSIGNEE' using errcode = 'P0001'; end if;
    if direct_manager_id is not null then
      candidate_result := internal_security.process_assignment_candidate(
        requested_tenant_id, requested_hr_group_id, requested_administration_id, as_of_date,
        direct_manager_id, requested_actor_employee_id, false,
        null, null, 'direct-manager', null, '[]'::jsonb
      );
      candidate := candidate_result -> 'candidate'; rejection := candidate_result -> 'rejection';
      if candidate is not null and candidate <> 'null'::jsonb then candidates := candidates || jsonb_build_array(candidate); end if;
      if rejection is not null and rejection <> 'null'::jsonb then rejections := rejections || jsonb_build_array(rejection); end if;
    end if;
  elsif selector ->> 'type' in ('MANAGEMENT_ROLE_ON_SUBJECT_DEPARTMENT', 'MANAGEMENT_ROLE_ON_SELECTED_DEPARTMENT', 'MANAGEMENT_ROLE_ON_PROCESS_DEPARTMENT') then
    if selector ->> 'type' = 'MANAGEMENT_ROLE_ON_SUBJECT_DEPARTMENT' then
      select count(*), min(organization.department_id)
        into direct_manager_count, department_id
      from public.employee_organizations organization
      where organization.tenant_id = requested_tenant_id
        and organization.hr_group_id = requested_hr_group_id
        and organization.employee_id = requested_subject_employee_id
        and organization.effective_from <= as_of_date
        and (organization.effective_to is null or organization.effective_to >= as_of_date);
      if direct_manager_count > 1 then raise exception 'AMBIGUOUS_ASSIGNEE' using errcode = 'P0001'; end if;
    elsif selector ->> 'type' = 'MANAGEMENT_ROLE_ON_SELECTED_DEPARTMENT' then
      selected_value := coalesce(requested_fields, '{}'::jsonb) -> (selector ->> 'departmentFieldKey');
      department_id := coalesce(selected_value ->> 'id', selected_value #>> '{}')::uuid;
    else
      selected_value := coalesce(requested_fields, '{}'::jsonb) -> 'processDepartmentId';
      department_id := coalesce(selected_value ->> 'id', selected_value #>> '{}')::uuid;
      if department_id is null then
        select min(organization.department_id) into department_id
        from public.employee_organizations organization
        where organization.tenant_id = requested_tenant_id
          and organization.hr_group_id = requested_hr_group_id
          and organization.employee_id = requested_subject_employee_id
          and organization.effective_from <= as_of_date
          and (organization.effective_to is null or organization.effective_to >= as_of_date);
      end if;
    end if;

    resolve_department_id := department_id;
    if resolve_department_id is not null then
      with recursive department_chain as (
        select department.id, department.parent_id, 0 as depth, array[department.id] as path
        from public.departments department
        where department.tenant_id = requested_tenant_id
          and department.hr_group_id = requested_hr_group_id
          and department.id = resolve_department_id
          and department.is_active
        union all
        select parent.id, parent.parent_id, child.depth + 1, child.path || parent.id
        from department_chain child
        join public.departments parent
          on parent.tenant_id = requested_tenant_id
         and parent.hr_group_id = requested_hr_group_id
         and parent.id = child.parent_id
         and parent.is_active
        where not parent.id = any(child.path)
      )
      select min(department_chain.depth) into role_depth
      from department_chain
      join public.department_management management on management.department_id = department_chain.id
      join public.management_roles role on role.id = management.management_role_id
      where role.code = selector ->> 'roleCode'
        and role.is_active
        and management.effective_from <= as_of_date
        and (management.effective_to is null or management.effective_to >= as_of_date);

      if role_depth is not null then
        for candidate_row in
          select resolved.employee_id, resolved.management_role_id, resolved.role_code, resolved.department_id
          from (
            with recursive department_chain as (
              select department.id, department.parent_id, 0 as depth, array[department.id] as path
              from public.departments department
              where department.tenant_id = requested_tenant_id
                and department.hr_group_id = requested_hr_group_id
                and department.id = resolve_department_id
                and department.is_active
              union all
              select parent.id, parent.parent_id, child.depth + 1, child.path || parent.id
              from department_chain child
              join public.departments parent
                on parent.tenant_id = requested_tenant_id
               and parent.hr_group_id = requested_hr_group_id
               and parent.id = child.parent_id
               and parent.is_active
              where not parent.id = any(child.path)
            )
            select distinct management.employee_id, management.management_role_id,
              role.code as role_code, department_chain.id as department_id
            from department_chain
            join public.department_management management on management.department_id = department_chain.id
            join public.management_roles role on role.id = management.management_role_id
            where department_chain.depth = role_depth
              and role.code = selector ->> 'roleCode'
              and role.is_active
              and management.effective_from <= as_of_date
              and (management.effective_to is null or management.effective_to >= as_of_date)
          ) resolved
        loop
          candidate_result := internal_security.process_assignment_candidate(
            requested_tenant_id, requested_hr_group_id, requested_administration_id, as_of_date,
            candidate_row.employee_id, requested_actor_employee_id, false,
            candidate_row.management_role_id, candidate_row.role_code, 'management-role', candidate_row.department_id, '[]'::jsonb
          );
          candidate := candidate_result -> 'candidate'; rejection := candidate_result -> 'rejection';
          if candidate is not null and candidate <> 'null'::jsonb and not exists (
            select 1 from pg_catalog.jsonb_array_elements(candidates) item where item ->> 'employeeId' = candidate ->> 'employeeId'
          ) then candidates := candidates || jsonb_build_array(candidate); end if;
          if rejection is not null and rejection <> 'null'::jsonb then rejections := rejections || jsonb_build_array(rejection); end if;
        end loop;
      end if;
    end if;
  elsif selector ->> 'type' = 'PERMISSION_WORK_QUEUE' then
    for employee_id in
      select distinct employee.id
      from public.employees employee
      where employee.tenant_id = requested_tenant_id
        and employee.hr_group_id = requested_hr_group_id
        and employee.deleted_at is null
        and employee.is_active
        and employee.auth_user_id is not null
        and (
          exists (
            select 1
            from public.user_hr_group_access access
            join public.role_permissions role_permission on role_permission.management_role_id = access.management_role_id
            join public.permissions permission on permission.id = role_permission.permission_id
            where access.user_id = employee.auth_user_id
              and access.tenant_id = requested_tenant_id
              and access.hr_group_id = requested_hr_group_id
              and access.is_active
              and permission.code = selector ->> 'permission'
          )
          or exists (
            select 1
            from public.user_access access
            join public.role_permissions role_permission on role_permission.management_role_id = access.management_role_id
            join public.permissions permission on permission.id = role_permission.permission_id
            where access.user_id = employee.auth_user_id
              and access.tenant_id = requested_tenant_id
              and access.hr_group_id = requested_hr_group_id
              and access.is_active
              and access.scope_type = requested_scope_type
              and (requested_scope_type = 'TENANT'::public.access_scope_type or access.administration_id = requested_administration_id)
              and permission.code = selector ->> 'permission'
          )
        )
    loop
      candidate_result := internal_security.process_assignment_candidate(
        requested_tenant_id, requested_hr_group_id, requested_administration_id, as_of_date,
        employee_id, requested_actor_employee_id, false,
        null, null, 'queue:' || (selector ->> 'queueKey'), null, '[]'::jsonb
      );
      candidate := candidate_result -> 'candidate'; rejection := candidate_result -> 'rejection';
      if candidate is not null and candidate <> 'null'::jsonb then candidates := candidates || jsonb_build_array(candidate); end if;
      if rejection is not null and rejection <> 'null'::jsonb then rejections := rejections || jsonb_build_array(rejection); end if;
    end loop;
  elsif selector ->> 'type' = 'PROCESS_OWNER_QUEUE' then
    for employee_id in
      select distinct employee.id
      from public.employees employee
      where employee.tenant_id = requested_tenant_id
        and employee.hr_group_id = requested_hr_group_id
        and employee.deleted_at is null
        and employee.is_active
        and employee.auth_user_id is not null
        and exists (
          select 1
          from public.user_hr_group_access access
          join public.role_permissions role_permission on role_permission.management_role_id = access.management_role_id
          join public.permissions permission on permission.id = role_permission.permission_id
          where access.user_id = employee.auth_user_id
            and access.tenant_id = requested_tenant_id
            and access.hr_group_id = requested_hr_group_id
            and access.is_active
            and permission.code = 'process-operations:read'
        )
    loop
      candidate_result := internal_security.process_assignment_candidate(
        requested_tenant_id, requested_hr_group_id, requested_administration_id, as_of_date,
        employee_id, requested_actor_employee_id, false,
        null, null, 'process-owner-queue:' || (selector ->> 'queueKey'), null, '[]'::jsonb
      );
      candidate := candidate_result -> 'candidate'; rejection := candidate_result -> 'rejection';

      if candidate is not null and candidate <> 'null'::jsonb then candidates := candidates || jsonb_build_array(candidate); end if;
      if rejection is not null and rejection <> 'null'::jsonb then rejections := rejections || jsonb_build_array(rejection); end if;
    end loop;
  else
    raise exception 'INVALID_ASSIGNMENT_SELECTOR' using errcode = 'P0001';
  end if;

  if requested_subject_employee_id is not null
    and coalesce(requested_participant ->> 'permission', '') like 'process-task:%' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'employeeId', candidate.value -> 'employeeId',
      'reason', 'TEAM_SCOPE_REQUIRED'
    )), '[]'::jsonb)
      into rejected_candidates
    from pg_catalog.jsonb_array_elements(candidates) candidate(value)
    where not internal_security.process_subject_actor_has_permission(
      requested_tenant_id, requested_hr_group_id, requested_scope_type,
      requested_administration_id, requested_subject_employee_id,
      (candidate.value ->> 'userId')::uuid,
      (candidate.value ->> 'employeeId')::uuid,
      requested_participant ->> 'permission', current_date
    );
    rejections := rejections || rejected_candidates;
    select coalesce(jsonb_agg(candidate.value), '[]'::jsonb)
      into candidates
    from pg_catalog.jsonb_array_elements(candidates) candidate(value)
    where internal_security.process_subject_actor_has_permission(
      requested_tenant_id, requested_hr_group_id, requested_scope_type,
      requested_administration_id, requested_subject_employee_id,
      (candidate.value ->> 'userId')::uuid,
      (candidate.value ->> 'employeeId')::uuid,
      requested_participant ->> 'permission', current_date
    );
  end if;
  if mode_name = 'EXACTLY_ONE' and pg_catalog.jsonb_array_length(candidates) <> 1 then
    if pg_catalog.jsonb_array_length(candidates) = 0 then raise exception 'NO_ASSIGNEE' using errcode = 'P0001'; end if;
    raise exception 'AMBIGUOUS_ASSIGNEE' using errcode = 'P0001';
  end if;
  if mode_name in ('ANY_ONE', 'ALL') and pg_catalog.jsonb_array_length(candidates) = 0 then
    raise exception 'NO_ASSIGNEE' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'assignmentMode', mode_name,
    'resolutionDatePolicy', policy_name,
    'asOfDate', as_of_date,
    'source', source_name,
    'candidateEmployeeIds', coalesce((select jsonb_agg(item -> 'employeeId') from pg_catalog.jsonb_array_elements(candidates) item), '[]'::jsonb),
    'candidates', candidates,
    'rejectedCandidates', rejections,
    'processVersionId', requested_process_version_id,
    'instanceId', requested_process_instance_id
  );
end;
$$;


create or replace function internal_security.claim_process_work_item(
  requested_work_item_id uuid,
  requested_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  actor_employee_id uuid;
  candidate_ok boolean;
  actor_is_subject boolean;
  event_id uuid;
  resulting_version bigint;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;

  select employee.id into actor_employee_id
  from public.employees employee
  where employee.auth_user_id = auth.uid()
    and employee.deleted_at is null
  order by employee.created_at, employee.id
  limit 1;
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;

  select instance.* into instance_row
  from public.process_instances instance
  join public.process_work_items item
    on item.tenant_id = instance.tenant_id
   and item.hr_group_id = instance.hr_group_id
   and item.process_instance_id = instance.id
   and item.id = requested_work_item_id
  for update of instance;
  if instance_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  actor_employee_id := internal_security.current_employee_id(instance_row.tenant_id, instance_row.hr_group_id);
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;

  select item.* into item_row
  from public.process_work_items item
  where item.tenant_id = instance_row.tenant_id
    and item.hr_group_id = instance_row.hr_group_id
    and item.id = requested_work_item_id
  for update;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if item_row.status = 'CLAIMED' then raise exception 'ALREADY_CLAIMED' using errcode = 'P0001'; end if;
  if item_row.status <> 'OPEN' then raise exception 'WORK_ITEM_NOT_OPEN' using errcode = 'P0001'; end if;
  if item_row.expected_version <> requested_expected_version then raise exception 'STALE_ASSIGNMENT' using errcode = 'P0001'; end if;

  if not internal_security.process_work_item_user_has_permission(
    item_row.id, auth.uid(), actor_employee_id, 'process-task:act'
  ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not internal_security.process_work_item_user_is_latest_candidate(
    item_row.id, auth.uid(), actor_employee_id
  ) then raise exception 'INELIGIBLE_ASSIGNEE' using errcode = '42501'; end if;
  actor_is_subject := internal_security.process_instance_actor_is_subject(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, actor_employee_id
  );
  if actor_is_subject and not item_row.allow_self_assignment then
    raise exception 'SELF_ASSIGNMENT_FORBIDDEN' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.process_work_item_candidates candidate
    where candidate.tenant_id = item_row.tenant_id
      and candidate.hr_group_id = item_row.hr_group_id
      and candidate.work_item_id = item_row.id
      and candidate.employee_id = actor_employee_id
      and candidate.candidate_user_id = auth.uid()
      and candidate.is_eligible
      and candidate.resolution_revision = (
        select max(latest.resolution_revision)
        from public.process_work_item_candidates latest
        where latest.tenant_id = item_row.tenant_id
          and latest.hr_group_id = item_row.hr_group_id
          and latest.work_item_id = item_row.id
      )
  ) into candidate_ok;
  if not candidate_ok then raise exception 'INELIGIBLE_ASSIGNEE' using errcode = '42501'; end if;

  update public.process_work_items
  set status = 'CLAIMED',
      assignee_employee_id = actor_employee_id,
      claimed_by_user_id = auth.uid(),
      claimed_at = timezone('utc', now()),
      expected_version = expected_version + 1
  where id = item_row.id;
  resulting_version := item_row.expected_version + 1;

  event_id := internal_security.append_process_event(
    item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.id,
    'WORK_ITEM_CLAIMED',
    jsonb_build_object('expectedVersion', item_row.expected_version, 'resultingVersion', resulting_version, 'assignmentMode', item_row.assignment_mode::text),
    auth.uid(), actor_employee_id
  );

  return jsonb_build_object(
    'workItemId', item_row.id,
    'status', 'CLAIMED',
    'assigneeEmployeeId', actor_employee_id,
    'expectedVersion', resulting_version,
    'eventId', event_id
  );
end;
$$;


create or replace function internal_security.release_process_work_item(
  requested_work_item_id uuid,
  requested_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  actor_employee_id uuid;
  resulting_version bigint;
  event_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select employee.id into actor_employee_id
  from public.employees employee
  where employee.auth_user_id = auth.uid()
    and employee.deleted_at is null
  order by employee.created_at, employee.id
  limit 1;
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;

  select instance.* into instance_row
  from public.process_instances instance
  join public.process_work_items item
    on item.tenant_id = instance.tenant_id
   and item.hr_group_id = instance.hr_group_id
   and item.process_instance_id = instance.id
   and item.id = requested_work_item_id
  for update of instance;
  if instance_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  actor_employee_id := internal_security.current_employee_id(instance_row.tenant_id, instance_row.hr_group_id);
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;

  select item.* into item_row
  from public.process_work_items item
  where item.tenant_id = instance_row.tenant_id
    and item.hr_group_id = instance_row.hr_group_id
    and item.id = requested_work_item_id
  for update;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if item_row.status <> 'CLAIMED' then raise exception 'WORK_ITEM_NOT_CLAIMED' using errcode = 'P0001'; end if;
  if item_row.expected_version <> requested_expected_version then raise exception 'STALE_ASSIGNMENT' using errcode = 'P0001'; end if;
  if not internal_security.process_work_item_user_has_permission(
    item_row.id, auth.uid(), actor_employee_id, 'process-task:act'
  ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if item_row.claimed_by_user_id <> auth.uid()
     and not internal_security.process_work_item_user_has_permission(
       item_row.id, auth.uid(), actor_employee_id, 'process-task:reassign'
     ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  update public.process_work_items
  set status = 'OPEN',
      assignee_employee_id = case when assignment_mode = 'EXACTLY_ONE' then assignee_employee_id else null end,
      claimed_by_user_id = null,
      claimed_at = null,
      expected_version = expected_version + 1
  where id = item_row.id;
  resulting_version := item_row.expected_version + 1;
  event_id := internal_security.append_process_event(
    item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.id,
    'WORK_ITEM_RELEASED',
    jsonb_build_object('expectedVersion', item_row.expected_version, 'resultingVersion', resulting_version),
    auth.uid(), actor_employee_id
  );
  return jsonb_build_object(
    'workItemId', item_row.id,
    'status', 'OPEN',
    'assigneeEmployeeId', case when item_row.assignment_mode = 'EXACTLY_ONE' then item_row.assignee_employee_id else null end,
    'expectedVersion', resulting_version,
    'eventId', event_id
  );
end;
$$;


create or replace function internal_security.reassign_process_work_item(
  requested_work_item_id uuid,
  requested_expected_version bigint,
  requested_employee_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  target_employee public.employees%rowtype;
  actor_employee_id uuid;
  candidate_ok boolean;
  resulting_version bigint;
  event_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select employee.id into actor_employee_id from public.employees employee where employee.auth_user_id = auth.uid() and employee.deleted_at is null order by employee.created_at, employee.id limit 1;
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;
  select instance.* into instance_row from public.process_instances instance join public.process_work_items item on item.tenant_id = instance.tenant_id and item.hr_group_id = instance.hr_group_id and item.process_instance_id = instance.id and item.id = requested_work_item_id for update of instance;
  if instance_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  actor_employee_id := internal_security.current_employee_id(instance_row.tenant_id, instance_row.hr_group_id);
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;
  select item.* into item_row from public.process_work_items item where item.tenant_id = instance_row.tenant_id and item.hr_group_id = instance_row.hr_group_id and item.id = requested_work_item_id for update;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if item_row.status in ('COMPLETED', 'CANCELLED', 'EXPIRED') then raise exception 'WORK_ITEM_NOT_REASSIGNABLE' using errcode = 'P0001'; end if;
  if item_row.expected_version <> requested_expected_version then raise exception 'STALE_ASSIGNMENT' using errcode = 'P0001'; end if;
  if not internal_security.process_work_item_user_has_permission(item_row.id, auth.uid(), actor_employee_id, 'process-task:reassign') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select employee.* into target_employee
  from public.employees employee
  where employee.tenant_id = item_row.tenant_id
    and employee.hr_group_id = item_row.hr_group_id
    and employee.id = requested_employee_id
    and employee.is_active
    and not employee.is_archived
    and employee.deleted_at is null
    and employee.auth_user_id is not null;
  if target_employee.id is null then raise exception 'INELIGIBLE_ASSIGNEE' using errcode = '42501'; end if;
  if instance_row.scope_type = 'ADMINISTRATION'
     and not exists (
       select 1 from public.employments employment
       where employment.tenant_id = item_row.tenant_id
         and employment.hr_group_id = item_row.hr_group_id
         and employment.administration_id = instance_row.administration_id
         and employment.employee_id = target_employee.id
         and employment.deleted_at is null
     ) then raise exception 'CROSS_SCOPE_CANDIDATE' using errcode = '42501'; end if;
  if internal_security.process_instance_actor_is_subject(item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, target_employee.id) and not item_row.allow_self_assignment then raise exception 'SELF_ASSIGNMENT_FORBIDDEN' using errcode = '42501'; end if;

  select exists (
    select 1 from public.process_work_item_candidates candidate
    where candidate.tenant_id = item_row.tenant_id
      and candidate.hr_group_id = item_row.hr_group_id
      and candidate.work_item_id = item_row.id
      and candidate.employee_id = target_employee.id
      and candidate.candidate_user_id = target_employee.auth_user_id
      and candidate.is_eligible
      and candidate.resolution_revision = (select max(latest.resolution_revision) from public.process_work_item_candidates latest where latest.tenant_id = item_row.tenant_id and latest.hr_group_id = item_row.hr_group_id and latest.work_item_id = item_row.id)
  ) into candidate_ok;
  if not candidate_ok or not internal_security.process_work_item_user_has_permission(item_row.id, target_employee.auth_user_id, target_employee.id, 'process-task:act') then raise exception 'INELIGIBLE_ASSIGNEE' using errcode = '42501'; end if;

  update public.process_work_items
  set status = 'OPEN', assignee_employee_id = target_employee.id, claimed_by_user_id = null, claimed_at = null, blocked_code = null, expected_version = expected_version + 1
  where id = item_row.id;
  resulting_version := item_row.expected_version + 1;
  event_id := internal_security.append_process_event(item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.id, 'WORK_ITEM_REASSIGNED', jsonb_build_object('targetEmployeeId', target_employee.id, 'expectedVersion', item_row.expected_version, 'resultingVersion', resulting_version), auth.uid(), actor_employee_id);
  return jsonb_build_object('workItemId', item_row.id, 'status', 'OPEN', 'assigneeEmployeeId', target_employee.id, 'expectedVersion', resulting_version, 'eventId', event_id);
end;
$$;


create or replace function internal_security.re_resolve_process_work_item(
  requested_work_item_id uuid,
  requested_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  actor_employee_id uuid;
  eligible_count integer;
  resulting_version bigint;
  resulting_assignee uuid;
  event_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select employee.id into actor_employee_id from public.employees employee where employee.auth_user_id = auth.uid() and employee.deleted_at is null order by employee.created_at, employee.id limit 1;
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;
  select instance.* into instance_row from public.process_instances instance join public.process_work_items item on item.tenant_id = instance.tenant_id and item.hr_group_id = instance.hr_group_id and item.process_instance_id = instance.id and item.id = requested_work_item_id for update of instance;
  if instance_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  actor_employee_id := internal_security.current_employee_id(instance_row.tenant_id, instance_row.hr_group_id);
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;
  select item.* into item_row from public.process_work_items item where item.tenant_id = instance_row.tenant_id and item.hr_group_id = instance_row.hr_group_id and item.id = requested_work_item_id for update;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if item_row.status <> 'BLOCKED' then raise exception 'WORK_ITEM_NOT_BLOCKED' using errcode = 'P0001'; end if;
  if item_row.expected_version <> requested_expected_version then raise exception 'STALE_ASSIGNMENT' using errcode = 'P0001'; end if;
  if not internal_security.process_work_item_user_has_permission(item_row.id, auth.uid(), actor_employee_id, 'process-operations:write')
    and not internal_security.process_work_item_user_has_permission(item_row.id, auth.uid(), actor_employee_id, 'process-task:reassign') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select count(*) into eligible_count
  from public.process_work_item_candidates candidate
  where candidate.tenant_id = item_row.tenant_id
    and candidate.hr_group_id = item_row.hr_group_id
    and candidate.work_item_id = item_row.id
    and candidate.is_eligible
    and internal_security.process_work_item_user_has_permission(item_row.id, candidate.candidate_user_id, candidate.employee_id, 'process-task:act')
    and candidate.resolution_revision = (select max(latest.resolution_revision) from public.process_work_item_candidates latest where latest.tenant_id = item_row.tenant_id and latest.hr_group_id = item_row.hr_group_id and latest.work_item_id = item_row.id);
  if eligible_count = 0 then raise exception 'NO_ASSIGNEE' using errcode = 'P0001'; end if;
  if item_row.assignment_mode = 'EXACTLY_ONE' and eligible_count <> 1 then raise exception 'AMBIGUOUS_ASSIGNEE' using errcode = 'P0001'; end if;

  resulting_assignee := case when item_row.assignment_mode = 'EXACTLY_ONE' then (select candidate.employee_id from public.process_work_item_candidates candidate where candidate.tenant_id = item_row.tenant_id and candidate.hr_group_id = item_row.hr_group_id and candidate.work_item_id = item_row.id and candidate.is_eligible and internal_security.process_work_item_user_has_permission(item_row.id, candidate.candidate_user_id, candidate.employee_id, 'process-task:act') and candidate.resolution_revision = (select max(latest.resolution_revision) from public.process_work_item_candidates latest where latest.tenant_id = item_row.tenant_id and latest.hr_group_id = item_row.hr_group_id and latest.work_item_id = item_row.id) limit 1) else null end;
  update public.process_work_items set status = 'OPEN', assignee_employee_id = resulting_assignee, claimed_by_user_id = null, claimed_at = null, blocked_code = null, expected_version = expected_version + 1 where id = item_row.id;
  resulting_version := item_row.expected_version + 1;
  event_id := internal_security.append_process_event(item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.id, 'WORK_ITEM_RE_RESOLVED', jsonb_build_object('eligibleCandidateCount', eligible_count, 'expectedVersion', item_row.expected_version, 'resultingVersion', resulting_version), auth.uid(), actor_employee_id);
  return jsonb_build_object('workItemId', item_row.id, 'status', 'OPEN', 'assigneeEmployeeId', resulting_assignee, 'expectedVersion', resulting_version, 'eventId', event_id);
end;
$$;


create or replace function internal_security.perform_process_work_item_action(
  requested_work_item_id uuid,
  requested_action text,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  step_row public.process_step_instances%rowtype;
  version_row public.process_versions%rowtype;
  actor_user_id uuid := auth.uid();
  actor_employee_id uuid;
  existing_event_id uuid;
  existing_actor_user_id uuid;
  existing_event_work_item_id uuid;
  existing_event_action text;
  event_id uuid;
  transition jsonb;
  definition_content jsonb;
  step_definition jsonb;
  subject jsonb;
  fields jsonb;
  remaining_all integer;
begin
  if actor_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if requested_idempotency_key is null or pg_catalog.btrim(requested_idempotency_key) = '' then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001'; end if;

  select instance.* into instance_row
  from public.process_instances instance
  join public.process_work_items item
    on item.tenant_id = instance.tenant_id
   and item.hr_group_id = instance.hr_group_id
   and item.process_instance_id = instance.id
   and item.id = requested_work_item_id
  for update of instance;
  if instance_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;

  actor_employee_id := internal_security.current_employee_id(instance_row.tenant_id, instance_row.hr_group_id);
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;
  if not internal_security.process_instance_user_has_permission(instance_row.id, actor_user_id, 'process-task:act', current_date) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select event.id, event.actor_user_id, event.work_item_id, event.payload ->> 'action'
    into existing_event_id, existing_actor_user_id, existing_event_work_item_id, existing_event_action
  from public.process_events event
  where event.tenant_id = instance_row.tenant_id
    and event.hr_group_id = instance_row.hr_group_id
    and event.process_instance_id = instance_row.id
    and event.idempotency_key = pg_catalog.btrim(requested_idempotency_key);
  if existing_event_id is not null then
    if existing_actor_user_id is distinct from actor_user_id
      or existing_event_work_item_id is distinct from requested_work_item_id
      or existing_event_action is distinct from requested_action then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001';
    end if;
    return internal_security.process_runtime_result(instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, existing_event_id);
  end if;

  select item.* into item_row
  from public.process_work_items item
  where item.tenant_id = instance_row.tenant_id
    and item.hr_group_id = instance_row.hr_group_id
    and item.id = requested_work_item_id
  for update;
  select step.* into step_row
  from public.process_step_instances step
  where step.tenant_id = item_row.tenant_id
    and step.hr_group_id = item_row.hr_group_id
    and step.process_instance_id = item_row.process_instance_id
    and step.id = item_row.step_instance_id
  for update;
  if item_row.id is null or step_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if instance_row.status not in ('RUNNING'::public.process_instance_status, 'BLOCKED'::public.process_instance_status) then
    raise exception 'PROCESS_INSTANCE_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  if step_row.status <> 'ACTIVE'::public.process_step_instance_status then raise exception 'STEP_NOT_ACTIVE' using errcode = 'P0001'; end if;
  if item_row.status not in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then
    raise exception 'WORK_ITEM_NOT_OPEN' using errcode = 'P0001';
  end if;
  if item_row.expected_version <> requested_expected_version then raise exception 'STALE_STATE' using errcode = 'P0001'; end if;

  if requested_step_expected_version is not null and step_row.expected_version <> requested_step_expected_version then
    raise exception 'STALE_STATE' using errcode = 'P0001';
  end if;

  if not internal_security.process_instance_user_has_permission(
    instance_row.id, actor_user_id, 'process-task:act', current_date
  ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if item_row.status = 'CLAIMED' and item_row.claimed_by_user_id <> actor_user_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select version.* into version_row
  from public.process_versions version
  where version.tenant_id = instance_row.tenant_id
    and version.hr_group_id = instance_row.hr_group_id
    and version.id = instance_row.process_version_id;
  if version_row.id is null then raise exception 'PROCESS_VERSION_NOT_FOUND' using errcode = 'P0002'; end if;
  definition_content := internal_security.process_definition_content(version_row.definition_json);
  select value into step_definition
  from pg_catalog.jsonb_array_elements(coalesce(definition_content -> 'steps', '[]'::jsonb)) value
  where value ->> 'key' = item_row.step_key;
  if step_definition is null then raise exception 'STEP_NOT_FOUND' using errcode = 'P0001'; end if;
  if not (exists (
    select 1 from pg_catalog.jsonb_array_elements(coalesce(step_definition -> 'allowedActions', '[]'::jsonb)) action
    where action #>> '{}' = requested_action
  )) then raise exception 'FORBIDDEN_ACTION' using errcode = '42501'; end if;

  subject := internal_security.process_subject_context(instance_row.tenant_id, instance_row.hr_group_id, instance_row.id);
  fields := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb);
  if step_definition ->> 'type' = 'FORM' then
    fields := fields || coalesce(internal_security.process_form_runtime_fields(item_row.id), '{}'::jsonb);
    perform internal_security.prepare_process_form_action(item_row.id, requested_action);
  end if;
  transition := internal_security.select_process_transition(definition_content, item_row.step_key, requested_action, fields, subject);

  update public.process_work_items
  set status = 'COMPLETED'::public.process_work_item_status,
      expected_version = expected_version + 1
  where id = item_row.id;

  if item_row.assignment_mode = 'ALL'::public.process_assignment_mode then
    select count(*) into remaining_all
    from public.process_work_items sibling
    where sibling.tenant_id = item_row.tenant_id
      and sibling.hr_group_id = item_row.hr_group_id
      and sibling.step_instance_id = item_row.step_instance_id
      and sibling.status <> 'COMPLETED'::public.process_work_item_status
      and sibling.status <> 'CANCELLED'::public.process_work_item_status;
    if remaining_all > 0 then
      update public.process_step_instances
      set expected_version = expected_version + 1
      where id = step_row.id;
      update public.process_instances
      set instance_version = instance_version + 1
      where id = instance_row.id;
      event_id := internal_security.append_process_runtime_event(
        item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.id,
        'PROCESS_WORK_ITEM_ACTIONED', jsonb_build_object('action', requested_action, 'stepKey', item_row.step_key, 'remainingParallelItems', remaining_all),
        actor_user_id, actor_employee_id, pg_catalog.btrim(requested_idempotency_key), coalesce(requested_correlation_id, instance_row.correlation_id)
      );
      return internal_security.process_runtime_result(item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, event_id);
    end if;
  end if;

  update public.process_step_instances
  set status = case requested_action
    when 'REJECT' then 'REJECTED'::public.process_step_instance_status
    when 'CANCEL' then 'CANCELLED'::public.process_step_instance_status
    else 'COMPLETED'::public.process_step_instance_status
  end,
      completed_at = timezone('utc', now()), expected_version = expected_version + 1
  where id = step_row.id;
  update public.process_instances
  set instance_version = instance_version + 1,
      current_step_key = null
  where id = instance_row.id;
  perform internal_security.activate_process_step(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id,
    instance_row.scope_type, instance_row.administration_id, instance_row.process_version_id,
    definition_content, transition ->> 'toStepKey', coalesce(requested_correlation_id, instance_row.correlation_id),
    actor_user_id, actor_employee_id
  );
  event_id := internal_security.append_process_runtime_event(
    item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.id,
    'PROCESS_WORK_ITEM_ACTIONED', jsonb_build_object('action', requested_action, 'stepKey', item_row.step_key, 'transitionKey', transition ->> 'key'),
    actor_user_id, actor_employee_id, pg_catalog.btrim(requested_idempotency_key), coalesce(requested_correlation_id, instance_row.correlation_id)
  );
  return internal_security.process_runtime_result(item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, event_id);
end;
$$;


create or replace function internal_security.get_process_work_projection(
  requested_hr_group_id uuid,
  requested_tab text default 'TODO',
  requested_search text default null,
  requested_status text default null,
  requested_process_definition_id uuid default null,
  requested_subject_employee_id uuid default null,
  requested_language text default 'nl',
  requested_sort text default 'NEEDS_ACTION',
  requested_limit integer default 100,
  requested_offset integer default 0
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
with base as (
  select
    item.id,
    item.tenant_id,
    item.hr_group_id,
    item.process_instance_id,
    item.step_instance_id,
    item.step_key,
    item.participant_key,
    item.assignment_mode,
    item.status,
    item.assignee_employee_id,
    item.claimed_by_user_id,
    item.claimed_at,
    item.available_at,
    item.deadline_at,
    item.expected_version,
    item.allow_self_assignment,
    item.assignment_snapshot,
    item.created_at,
    item.updated_at,
    instance.status as instance_status,
    instance.scope_type,
    instance.administration_id,
    instance.current_step_key,
    instance.instance_version,
    instance.started_at,
    instance.completed_at,
    instance.correlation_id,
    definition.id as process_definition_id,
    definition.key as process_key,
    definition.title as process_title,
    version.definition_json,
    coalesce(direct_subject.employee_id, employment.employee_id) as subject_employee_id,
    subject_employee.first_name as subject_first_name,
    subject_employee.birth_name as subject_birth_name,
    step_definition.step as step_definition,
    exists (
      select 1
      from public.process_work_item_candidates candidate
      where candidate.tenant_id = item.tenant_id
        and candidate.hr_group_id = item.hr_group_id
        and candidate.work_item_id = item.id
        and candidate.employee_id = internal_security.current_employee_id(item.tenant_id, item.hr_group_id)
        and candidate.candidate_user_id = auth.uid()
        and candidate.is_eligible
        and candidate.resolution_revision = (
          select max(latest.resolution_revision)
          from public.process_work_item_candidates latest
          where latest.tenant_id = item.tenant_id
            and latest.hr_group_id = item.hr_group_id
            and latest.work_item_id = item.id
        )
    ) as candidate_ok,
    internal_security.process_work_item_user_has_permission(
      item.id, auth.uid(), internal_security.current_employee_id(item.tenant_id, item.hr_group_id), 'process-task:act'
    ) as scope_can_act
  from public.process_work_items item
  join public.process_instances instance
    on instance.tenant_id = item.tenant_id
   and instance.hr_group_id = item.hr_group_id
   and instance.id = item.process_instance_id
  join public.process_definitions definition
    on definition.tenant_id = instance.tenant_id
   and definition.hr_group_id = instance.hr_group_id
   and definition.id = instance.process_definition_id
  join public.process_versions version
    on version.tenant_id = instance.tenant_id
   and version.hr_group_id = instance.hr_group_id
   and version.process_definition_id = instance.process_definition_id
   and version.id = instance.process_version_id
  left join public.process_employee_subjects direct_subject
    on direct_subject.tenant_id = instance.tenant_id
   and direct_subject.hr_group_id = instance.hr_group_id
   and direct_subject.process_instance_id = instance.id
  left join public.process_employment_subjects employment_subject
    on employment_subject.tenant_id = instance.tenant_id
   and employment_subject.hr_group_id = instance.hr_group_id
   and employment_subject.process_instance_id = instance.id
  left join public.employments employment
    on employment.tenant_id = employment_subject.tenant_id
   and employment.hr_group_id = employment_subject.hr_group_id
   and employment.administration_id = employment_subject.administration_id
   and employment.id = employment_subject.employment_id
  left join public.employees subject_employee
    on subject_employee.tenant_id = instance.tenant_id
   and subject_employee.hr_group_id = instance.hr_group_id
   and subject_employee.id = coalesce(direct_subject.employee_id, employment.employee_id)
  left join lateral (
    select value as step
    from pg_catalog.jsonb_array_elements(coalesce(version.definition_json -> 'steps', '[]'::jsonb)) value
    where value ->> 'key' = item.step_key
    limit 1
  ) step_definition on true
  where item.hr_group_id = requested_hr_group_id
    and internal_security.process_work_item_can_read(item.tenant_id, item.hr_group_id, item.id)
    and (
      requested_subject_employee_id is null
      or coalesce(direct_subject.employee_id, employment.employee_id) = requested_subject_employee_id
    )
    and (
      requested_process_definition_id is null
      or instance.process_definition_id = requested_process_definition_id
    )
    and (
      requested_status is null
      or item.status::text = requested_status
      or instance.status::text = requested_status
    )
    and (
      requested_search is null
      or pg_catalog.btrim(requested_search) = ''
      or definition.key ilike '%' || pg_catalog.btrim(requested_search) || '%'
      or internal_security.process_localized_text(definition.title, requested_language, definition.key) ilike '%' || pg_catalog.btrim(requested_search) || '%'
      or pg_catalog.concat_ws(' ', subject_employee.first_name, subject_employee.birth_name) ilike '%' || pg_catalog.btrim(requested_search) || '%'
      or internal_security.process_localized_text(step_definition.step -> 'title', requested_language, item.step_key) ilike '%' || pg_catalog.btrim(requested_search) || '%'
    )
), classified as (
  select
    base.*,
    (base.scope_can_act) as can_act,
    (base.status = 'OPEN'::public.process_work_item_status and base.scope_can_act and base.candidate_ok) as can_claim,
    case
      when base.assignment_mode = 'ANY_ONE'::public.process_assignment_mode and base.candidate_ok then 'QUEUE'
      when base.candidate_ok then 'DIRECT'
      when base.scope_can_act then 'SCOPE'
      else 'PROCESS'
    end as received_via,
    case
      when base.status in ('COMPLETED'::public.process_work_item_status, 'CANCELLED'::public.process_work_item_status, 'EXPIRED'::public.process_work_item_status) then 'COMPLETED'
      when base.instance_status in ('COMPLETED'::public.process_instance_status, 'REJECTED'::public.process_instance_status, 'CANCELLED'::public.process_instance_status) then 'COMPLETED'
      when base.instance_status in ('WAITING'::public.process_instance_status, 'BLOCKED'::public.process_instance_status) then 'WAITING'
      when base.claimed_by_user_id = auth.uid() then 'CLAIMED'
      when base.scope_can_act then 'TODO'
      else 'WAITING'
    end as work_tab
  from base
), filtered as (
  select *
  from classified
  where upper(coalesce(requested_tab, 'TODO')) = 'ALL'
    or work_tab = upper(coalesce(requested_tab, 'TODO'))
    or (upper(coalesce(requested_tab, 'TODO')) = 'TODO' and status = 'OPEN'::public.process_work_item_status and can_act)
    or (upper(coalesce(requested_tab, 'TODO')) = 'CLAIMED' and claimed_by_user_id = auth.uid())
), counted as (
  select filtered.*, count(*) over () as total_count
  from filtered
), paged as (
  select *
  from counted
  order by
    case when upper(coalesce(requested_sort, 'NEEDS_ACTION')) = 'NEEDS_ACTION' and can_act and status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then 0 else 1 end,
    case when deadline_at is not null and deadline_at < timezone('utc', now()) then 0 else 1 end,
    case when upper(coalesce(requested_sort, 'NEEDS_ACTION')) = 'DEADLINE' then deadline_at end asc nulls last,
    case when upper(coalesce(requested_sort, 'NEEDS_ACTION')) <> 'DEADLINE' then updated_at end desc,
    id
  offset greatest(coalesce(requested_offset, 0), 0)
  limit least(greatest(coalesce(requested_limit, 100), 1), 200)
)
select jsonb_build_object(
  'items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'workItemId', page.id,
      'processInstanceId', page.process_instance_id,
      'stepInstanceId', page.step_instance_id,
      'processDefinitionId', page.process_definition_id,
      'processKey', page.process_key,
      'processTitle', internal_security.process_localized_text(page.process_title, requested_language, page.process_key),
      'subjectEmployeeId', page.subject_employee_id,
      'subjectName', nullif(pg_catalog.concat_ws(' ', page.subject_first_name, page.subject_birth_name), ''),
      'stepKey', page.step_key,
      'stepTitle', internal_security.process_localized_text(page.step_definition -> 'title', requested_language, page.step_key),
      'participantKey', page.participant_key,
      'assignmentMode', page.assignment_mode,
      'receivedVia', page.received_via,
      'assignmentExplanation', internal_security.process_work_item_assignment_explanation(page.assignment_snapshot),
      'status', page.status,
      'instanceStatus', page.instance_status,
      'currentStepKey', page.current_step_key,
      'instanceVersion', page.instance_version,
      'expectedVersion', page.expected_version,
      'claimedByUserId', page.claimed_by_user_id,
      'assigneeEmployeeId', page.assignee_employee_id,
      'claimedAt', page.claimed_at,
      'availableAt', page.available_at,
      'deadlineAt', page.deadline_at,
      'createdAt', page.created_at,
      'updatedAt', page.updated_at,
      'canAct', page.can_act,
      'canClaim', page.can_claim,
      'isOverdue', page.deadline_at is not null and page.deadline_at < timezone('utc', now()) and page.status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status)
    ) order by page.updated_at desc, page.id)
    from paged page
  ), '[]'::jsonb),
  'total', coalesce((select max(total_count) from paged), 0),
  'hasMore', coalesce((select max(total_count) from paged), 0) > greatest(coalesce(requested_offset, 0), 0) + least(greatest(coalesce(requested_limit, 100), 1), 200)
);
$$;


create or replace function internal_security.get_process_work_item_detail(
  requested_work_item_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  definition_row public.process_definitions%rowtype;
  version_row public.process_versions%rowtype;
  step_definition jsonb;
  subject_employee_id uuid;
  subject_name text;
  candidate_ok boolean;
  scope_can_act boolean;
  can_act boolean;
  can_reassign boolean;
  timeline jsonb;
  steps jsonb;
  work_items jsonb;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;

  select item.* into item_row
  from public.process_work_items item
  where item.id = requested_work_item_id;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.process_work_item_can_read(item_row.tenant_id, item_row.hr_group_id, item_row.id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select instance.* into instance_row
  from public.process_instances instance
  where instance.tenant_id = item_row.tenant_id
    and instance.hr_group_id = item_row.hr_group_id
    and instance.id = item_row.process_instance_id;
  select definition.* into definition_row
  from public.process_definitions definition
  where definition.tenant_id = instance_row.tenant_id
    and definition.hr_group_id = instance_row.hr_group_id
    and definition.id = instance_row.process_definition_id;
  select version.* into version_row
  from public.process_versions version
  where version.tenant_id = instance_row.tenant_id
    and version.hr_group_id = instance_row.hr_group_id
    and version.process_definition_id = instance_row.process_definition_id
    and version.id = instance_row.process_version_id;

  select value into step_definition
  from pg_catalog.jsonb_array_elements(coalesce(version_row.definition_json -> 'steps', '[]'::jsonb)) value
  where value ->> 'key' = item_row.step_key
  limit 1;
  select direct_subject.employee_id into subject_employee_id
  from public.process_employee_subjects direct_subject
  where direct_subject.tenant_id = instance_row.tenant_id
    and direct_subject.hr_group_id = instance_row.hr_group_id
    and direct_subject.process_instance_id = instance_row.id;
  if subject_employee_id is null then
    select employment.employee_id into subject_employee_id
    from public.process_employment_subjects subject
    join public.employments employment
      on employment.tenant_id = subject.tenant_id
     and employment.hr_group_id = subject.hr_group_id
     and employment.administration_id = subject.administration_id
     and employment.id = subject.employment_id
    where subject.tenant_id = instance_row.tenant_id
      and subject.hr_group_id = instance_row.hr_group_id
      and subject.process_instance_id = instance_row.id;
  end if;
  select nullif(pg_catalog.concat_ws(' ', employee.first_name, employee.birth_name), '') into subject_name
  from public.employees employee
  where employee.tenant_id = instance_row.tenant_id
    and employee.hr_group_id = instance_row.hr_group_id
    and employee.id = subject_employee_id;

  select exists (
    select 1
    from public.process_work_item_candidates candidate
    where candidate.tenant_id = item_row.tenant_id
      and candidate.hr_group_id = item_row.hr_group_id
      and candidate.work_item_id = item_row.id
      and candidate.employee_id = internal_security.current_employee_id(item_row.tenant_id, item_row.hr_group_id)
      and candidate.candidate_user_id = auth.uid()
      and candidate.is_eligible
      and candidate.resolution_revision = (
        select max(latest.resolution_revision)
        from public.process_work_item_candidates latest
        where latest.tenant_id = item_row.tenant_id
          and latest.hr_group_id = item_row.hr_group_id
          and latest.work_item_id = item_row.id
      )
  ) into candidate_ok;
  scope_can_act := internal_security.process_work_item_user_has_permission(
    item_row.id, auth.uid(), internal_security.current_employee_id(item_row.tenant_id, item_row.hr_group_id), 'process-task:act'
  );
  can_act := scope_can_act;
  can_reassign := internal_security.process_work_item_user_has_permission(
    item_row.id, auth.uid(), internal_security.current_employee_id(item_row.tenant_id, item_row.hr_group_id), 'process-task:reassign'
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', event.id,
    'eventType', event.event_type,
    'createdAt', event.created_at,
    'actorEmployeeId', event.actor_employee_id
  ) order by event.sequence_number), '[]'::jsonb) into timeline
  from public.process_events event
  where event.tenant_id = instance_row.tenant_id
    and event.hr_group_id = instance_row.hr_group_id
    and event.process_instance_id = instance_row.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', step.id,
    'stepKey', step.step_key,
    'status', step.status,
    'expectedVersion', step.expected_version,
    'activatedAt', step.activated_at,
    'completedAt', step.completed_at,
    'deadlineAt', step.deadline_at
  ) order by step.created_at, step.step_key), '[]'::jsonb) into steps
  from public.process_step_instances step
  where step.tenant_id = instance_row.tenant_id
    and step.hr_group_id = instance_row.hr_group_id
    and step.process_instance_id = instance_row.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', work_item.id,
    'stepKey', work_item.step_key,
    'participantKey', work_item.participant_key,
    'assignmentMode', work_item.assignment_mode,
    'status', work_item.status,
    'expectedVersion', work_item.expected_version,
    'availableAt', work_item.available_at,
    'deadlineAt', work_item.deadline_at
  ) order by work_item.created_at, work_item.id), '[]'::jsonb) into work_items
  from public.process_work_items work_item
  where work_item.tenant_id = instance_row.tenant_id
    and work_item.hr_group_id = instance_row.hr_group_id
    and work_item.process_instance_id = instance_row.id;

  return jsonb_build_object(
    'workItemId', item_row.id,
    'processInstanceId', instance_row.id,
    'processDefinitionId', definition_row.id,
    'processKey', definition_row.key,
    'processTitle', internal_security.process_localized_text(definition_row.title, requested_language, definition_row.key),
    'processDescription', internal_security.process_localized_text(definition_row.description, requested_language, null),
    'subjectEmployeeId', subject_employee_id,
    'subjectName', subject_name,
    'instanceStatus', instance_row.status,
    'currentStepKey', instance_row.current_step_key,
    'instanceVersion', instance_row.instance_version,
    'startedAt', instance_row.started_at,
    'completedAt', instance_row.completed_at,
    'correlationId', instance_row.correlation_id,
    'stepKey', item_row.step_key,
    'stepTitle', internal_security.process_localized_text(step_definition -> 'title', requested_language, item_row.step_key),
    'participantKey', item_row.participant_key,
    'assignmentMode', item_row.assignment_mode,
    'assignmentExplanation', internal_security.process_work_item_assignment_explanation(item_row.assignment_snapshot),
    'status', item_row.status,
    'expectedVersion', item_row.expected_version,
    'stepExpectedVersion', (select step.expected_version from public.process_step_instances step where step.id = item_row.step_instance_id),
    'claimedByUserId', item_row.claimed_by_user_id,
    'assigneeEmployeeId', item_row.assignee_employee_id,
    'claimedAt', item_row.claimed_at,
    'availableAt', item_row.available_at,
    'deadlineAt', item_row.deadline_at,
    'isOverdue', item_row.deadline_at is not null and item_row.deadline_at < timezone('utc', now()) and item_row.status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status),
    'canAct', can_act,
    'canClaim', item_row.status = 'OPEN'::public.process_work_item_status and can_act and candidate_ok,
    'canRelease', item_row.status = 'CLAIMED'::public.process_work_item_status and can_act and (item_row.claimed_by_user_id = auth.uid() or can_reassign),
    'canReassign', can_reassign,
    'allowedActions', coalesce(step_definition -> 'allowedActions', '[]'::jsonb),
    'steps', steps,
    'workItems', work_items,
    'timeline', timeline
  );
end;
$$;


create or replace function internal_security.get_unified_process_work_projection(
  requested_hr_group_id uuid,
  requested_view text default 'WORK',
  requested_tab text default 'TODO',
  requested_search text default null,
  requested_status text default null,
  requested_business_type text default null,
  requested_business_category text default null,
  requested_process_definition_id uuid default null,
  requested_administration_id uuid default null,
  requested_subject_employee_id uuid default null,
  requested_subject_employment_id uuid default null,
  requested_language text default 'nl',
  requested_sort text default 'NEEDS_ACTION',
  requested_limit integer default 100,
  requested_offset integer default 0
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
with base as (
  select
    item.id,
    item.tenant_id,
    item.hr_group_id,
    item.process_instance_id,
    item.step_instance_id,
    item.step_key,
    item.participant_key,
    item.assignment_mode,
    item.status,
    item.assignee_employee_id,
    item.claimed_by_user_id,
    item.claimed_at,
    item.available_at,
    item.deadline_at,
    item.expected_version,
    item.allow_self_assignment,
    item.assignment_snapshot,
    item.created_at,
    item.updated_at,
    item.business_type,
    item.business_category,
    instance.status as instance_status,
    instance.scope_type,
    instance.administration_id,
    instance.current_step_key,
    instance.instance_version,
    instance.started_at,
    instance.completed_at,
    instance.correlation_id,
    instance.initiator_user_id,
    definition.id as process_definition_id,
    definition.key as process_key,
    definition.title as process_title,
    version.definition_json,
    coalesce(direct_subject.employee_id, employment.employee_id) as subject_employee_id,
    employment_subject.employment_id as subject_employment_id,
    subject_employee.first_name as subject_first_name,
    subject_employee.birth_name as subject_birth_name,
    step_definition.step as step_definition,
    leave_link.leave_request_id,
    leave_request.status as leave_request_status,
    exists (
      select 1
      from public.process_work_item_candidates candidate
      where candidate.tenant_id = item.tenant_id
        and candidate.hr_group_id = item.hr_group_id
        and candidate.work_item_id = item.id
        and candidate.employee_id = internal_security.current_employee_id(item.tenant_id, item.hr_group_id)
        and candidate.candidate_user_id = auth.uid()
        and candidate.is_eligible
        and candidate.resolution_revision = (
          select max(latest.resolution_revision)
          from public.process_work_item_candidates latest
          where latest.tenant_id = item.tenant_id
            and latest.hr_group_id = item.hr_group_id
            and latest.work_item_id = item.id
        )
    ) as candidate_ok,
    internal_security.process_work_item_user_has_permission(
      item.id, auth.uid(), internal_security.current_employee_id(item.tenant_id, item.hr_group_id), 'process-task:act'
    ) as scope_can_act
  from public.process_work_items item
  join public.process_instances instance
    on instance.tenant_id = item.tenant_id
   and instance.hr_group_id = item.hr_group_id
   and instance.id = item.process_instance_id
  join public.process_definitions definition
    on definition.tenant_id = instance.tenant_id
   and definition.hr_group_id = instance.hr_group_id
   and definition.id = instance.process_definition_id
  join public.process_versions version
    on version.tenant_id = instance.tenant_id
   and version.hr_group_id = instance.hr_group_id
   and version.process_definition_id = instance.process_definition_id
   and version.id = instance.process_version_id
  left join public.process_employee_subjects direct_subject
    on direct_subject.tenant_id = instance.tenant_id
   and direct_subject.hr_group_id = instance.hr_group_id
   and direct_subject.process_instance_id = instance.id
  left join public.process_employment_subjects employment_subject
    on employment_subject.tenant_id = instance.tenant_id
   and employment_subject.hr_group_id = instance.hr_group_id
   and employment_subject.process_instance_id = instance.id
  left join public.employments employment
    on employment.tenant_id = employment_subject.tenant_id
   and employment.hr_group_id = employment_subject.hr_group_id
   and employment.administration_id = employment_subject.administration_id
   and employment.id = employment_subject.employment_id
  left join public.employees subject_employee
    on subject_employee.tenant_id = instance.tenant_id
   and subject_employee.hr_group_id = instance.hr_group_id
   and subject_employee.id = coalesce(direct_subject.employee_id, employment.employee_id)
  left join lateral (
    select value as step
    from pg_catalog.jsonb_array_elements(coalesce(version.definition_json -> 'steps', '[]'::jsonb)) value
    where value ->> 'key' = item.step_key
    limit 1
  ) step_definition on true
  left join public.process_leave_subjects leave_link
    on leave_link.tenant_id = instance.tenant_id
   and leave_link.hr_group_id = instance.hr_group_id
   and leave_link.process_instance_id = instance.id
  left join public.leave_requests leave_request
    on leave_request.tenant_id = leave_link.tenant_id
   and leave_request.hr_group_id = leave_link.hr_group_id
   and leave_request.administration_id = leave_link.administration_id
   and leave_request.id = leave_link.leave_request_id
  where item.hr_group_id = requested_hr_group_id
    and internal_security.process_work_item_can_read(item.tenant_id, item.hr_group_id, item.id)
    and (
      upper(coalesce(requested_view, 'WORK')) <> 'REQUESTS'
      or instance.initiator_user_id = auth.uid()
    )
    and (
      requested_administration_id is null
      or instance.administration_id = requested_administration_id
    )
    and (
      requested_subject_employee_id is null
      or coalesce(direct_subject.employee_id, employment.employee_id) = requested_subject_employee_id
    )
    and (
      requested_subject_employment_id is null
      or employment_subject.employment_id = requested_subject_employment_id
    )
    and (
      requested_process_definition_id is null
      or instance.process_definition_id = requested_process_definition_id
    )
    and (
      requested_business_type is null
      or pg_catalog.btrim(requested_business_type) = ''
      or item.business_type = upper(pg_catalog.btrim(requested_business_type))
    )
    and (
      requested_business_category is null
      or pg_catalog.btrim(requested_business_category) = ''
      or item.business_category = upper(pg_catalog.btrim(requested_business_category))
    )
    and (
      requested_search is null
      or pg_catalog.btrim(requested_search) = ''
      or definition.key ilike '%' || pg_catalog.btrim(requested_search) || '%'
      or internal_security.process_localized_text(definition.title, requested_language, definition.key) ilike '%' || pg_catalog.btrim(requested_search) || '%'
      or pg_catalog.concat_ws(' ', subject_employee.first_name, subject_employee.birth_name) ilike '%' || pg_catalog.btrim(requested_search) || '%'
      or internal_security.process_localized_text(step_definition.step -> 'title', requested_language, item.step_key) ilike '%' || pg_catalog.btrim(requested_search) || '%'
    )
), ranked as (
  select base.*,
    pg_catalog.row_number() over (
      partition by base.process_instance_id
      order by case when base.status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then 0 else 1 end, base.updated_at desc, base.id
    ) as request_rank
  from base
), classified as (
  select ranked.*,
    (ranked.scope_can_act) as can_act,
    (ranked.status = 'OPEN'::public.process_work_item_status and ranked.scope_can_act and ranked.candidate_ok) as can_claim,
    case
      when ranked.assignment_mode = 'ANY_ONE'::public.process_assignment_mode and ranked.candidate_ok then 'QUEUE'
      when ranked.candidate_ok then 'DIRECT'
      when ranked.scope_can_act then 'SCOPE'
      else 'PROCESS'
    end as received_via,
    case
      when ranked.business_type = 'LEAVE' and ranked.leave_request_status is not null then case ranked.leave_request_status
        when 'PENDING'::public.leave_request_status then case when ranked.status = 'CLAIMED'::public.process_work_item_status then 'IN_PROGRESS' else case when ranked.scope_can_act then 'OPEN' else 'WAITING' end end
        when 'CHANGES_REQUESTED'::public.leave_request_status then 'CHANGES_REQUESTED'
        when 'APPROVED'::public.leave_request_status then 'COMPLETED'
        when 'REJECTED'::public.leave_request_status then 'REJECTED'
        when 'CANCELLED'::public.leave_request_status then 'CANCELLED'
      end
      when ranked.instance_status = 'REJECTED'::public.process_instance_status then 'REJECTED'
      when ranked.instance_status = 'CANCELLED'::public.process_instance_status or ranked.status = 'CANCELLED'::public.process_work_item_status then 'CANCELLED'
      when ranked.status = 'EXPIRED'::public.process_work_item_status then 'CANCELLED'
      when ranked.status = 'CLAIMED'::public.process_work_item_status then 'IN_PROGRESS'
      when ranked.status = 'COMPLETED'::public.process_work_item_status and ranked.instance_status = 'COMPLETED'::public.process_instance_status then 'COMPLETED'
      when ranked.scope_can_act then 'OPEN'
      else 'WAITING'
    end as business_status,
    case
      when ranked.status in ('COMPLETED'::public.process_work_item_status, 'CANCELLED'::public.process_work_item_status, 'EXPIRED'::public.process_work_item_status) then 'COMPLETED'
      when ranked.instance_status in ('COMPLETED'::public.process_instance_status, 'REJECTED'::public.process_instance_status, 'CANCELLED'::public.process_instance_status) then 'COMPLETED'
      when ranked.instance_status in ('WAITING'::public.process_instance_status, 'BLOCKED'::public.process_instance_status) then 'WAITING'
      when ranked.claimed_by_user_id = auth.uid() then 'CLAIMED'
      when ranked.scope_can_act then 'TODO'
      else 'WAITING'
    end as work_tab
  from ranked
), filtered as (
  select classified.*
  from classified
  where (
    (upper(coalesce(requested_view, 'WORK')) = 'REQUESTS' and classified.request_rank = 1)
    or upper(coalesce(requested_view, 'WORK')) <> 'REQUESTS'
  )
  and (
    upper(coalesce(requested_view, 'WORK')) = 'REQUESTS'
    or upper(coalesce(requested_tab, 'TODO')) = 'ALL'
    or classified.work_tab = upper(coalesce(requested_tab, 'TODO'))
    or (upper(coalesce(requested_tab, 'TODO')) = 'TODO' and classified.status = 'OPEN'::public.process_work_item_status and classified.can_act)
    or (upper(coalesce(requested_tab, 'TODO')) = 'CLAIMED' and classified.claimed_by_user_id = auth.uid())
  )
  and (
    requested_status is null
    or pg_catalog.btrim(requested_status) = ''
    or classified.business_status = upper(pg_catalog.btrim(requested_status))
    or classified.status::text = upper(pg_catalog.btrim(requested_status))
    or classified.instance_status::text = upper(pg_catalog.btrim(requested_status))
  )
), counted as (
  select filtered.*, count(*) over () as total_count
  from filtered
), paged as (
  select *
  from counted
  order by
    case when upper(coalesce(requested_sort, 'NEEDS_ACTION')) = 'NEEDS_ACTION' and can_act and status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then 0 else 1 end,
    case when deadline_at is not null and deadline_at < timezone('utc', now()) then 0 else 1 end,
    case when upper(coalesce(requested_sort, 'NEEDS_ACTION')) = 'DEADLINE' then deadline_at end asc nulls last,
    case when upper(coalesce(requested_sort, 'NEEDS_ACTION')) <> 'DEADLINE' then updated_at end desc,
    id
  offset greatest(coalesce(requested_offset, 0), 0)
  limit least(greatest(coalesce(requested_limit, 100), 1), 200)
)
select jsonb_build_object(
  'items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'workItemId', page.id,
      'processInstanceId', page.process_instance_id,
      'stepInstanceId', page.step_instance_id,
      'processDefinitionId', page.process_definition_id,
      'processKey', page.process_key,
      'processTitle', internal_security.process_localized_text(page.process_title, requested_language, page.process_key),
      'subjectEmployeeId', page.subject_employee_id,
      'subjectEmploymentId', page.subject_employment_id,
      'subjectName', nullif(pg_catalog.concat_ws(' ', page.subject_first_name, page.subject_birth_name), ''),
      'stepKey', page.step_key,
      'stepTitle', internal_security.process_localized_text(page.step_definition -> 'title', requested_language, page.step_key),
      'participantKey', page.participant_key,
      'assignmentMode', page.assignment_mode,
      'receivedVia', page.received_via,
      'assignmentExplanation', internal_security.process_work_item_assignment_explanation(page.assignment_snapshot),
      'status', page.status,
      'instanceStatus', page.instance_status,
      'currentStepKey', page.current_step_key,
      'instanceVersion', page.instance_version,
      'expectedVersion', page.expected_version,
      'claimedByUserId', page.claimed_by_user_id,
      'assigneeEmployeeId', page.assignee_employee_id,
      'claimedAt', page.claimed_at,
      'availableAt', page.available_at,
      'deadlineAt', page.deadline_at,
      'createdAt', page.created_at,
      'updatedAt', page.updated_at,
      'canAct', page.can_act,
      'canClaim', page.can_claim,
      'isOverdue', page.deadline_at is not null and page.deadline_at < timezone('utc', now()) and page.status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status),
      'businessType', page.business_type,
      'businessCategory', page.business_category,
      'businessStatus', page.business_status,
      'leaveRequestId', page.leave_request_id
    ) order by page.updated_at desc, page.id)
    from paged page
  ), '[]'::jsonb),
  'total', coalesce((select max(total_count) from paged), 0),
  'hasMore', coalesce((select max(total_count) from paged), 0) > greatest(coalesce(requested_offset, 0), 0) + least(greatest(coalesce(requested_limit, 100), 1), 200)
);
$$;


create or replace function internal_security.commit_internal_transfer(
  requested_work_item_id uuid,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  preview jsonb;
  existing_commit public.process_domain_commits%rowtype;
  placement_id uuid;
  action_result jsonb;
  result_json jsonb;
  actor_id uuid := auth.uid();
  correlation_id uuid;
begin
  if actor_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if requested_idempotency_key is null or btrim(requested_idempotency_key) = '' then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001'; end if;
  select item.* into item_row from public.process_work_items item where item.id = requested_work_item_id for update;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  select instance.* into instance_row from public.process_instances instance where instance.id = item_row.process_instance_id for update;
  if instance_row.id is null then raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.process_work_item_user_has_permission(
    item_row.id, actor_id, internal_security.current_employee_id(instance_row.tenant_id, instance_row.hr_group_id), 'process-task:act'
  ) or not internal_security.process_work_item_user_has_permission(
    item_row.id, actor_id, internal_security.current_employee_id(instance_row.tenant_id, instance_row.hr_group_id), 'organization-placement:write'
  ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if item_row.status = 'CLAIMED' and item_row.claimed_by_user_id <> actor_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select commit_row.* into existing_commit
  from public.process_domain_commits commit_row
  where commit_row.process_instance_id = instance_row.id and commit_row.adapter_key = 'INTERNAL_TRANSFER_ORGANIZATION'
  for update;
  if existing_commit.id is not null then return existing_commit.result; end if;
  if item_row.step_key <> 'hr-validation' then raise exception 'INTERNAL_TRANSFER_HR_STEP_REQUIRED' using errcode = '42501'; end if;
  preview := internal_security.internal_transfer_projection(requested_work_item_id);
  if preview ->> 'status' = 'BLOCKING' then raise exception 'INTERNAL_TRANSFER_VALIDATION_BLOCKED' using errcode = '22023'; end if;

  placement_id := public.manage_employment_organization_timeline(
    (preview -> 'employee' ->> 'employmentId')::uuid,
    null,
    (preview ->> 'effectiveOn')::date,
    (preview -> 'proposed' ->> 'departmentId')::uuid,
    (preview -> 'proposed' ->> 'jobId')::uuid
  );
  update public.employee_organizations
  set direct_manager_id = (preview -> 'proposed' ->> 'managerId')::uuid
  where id = placement_id
    and employment_id = (preview -> 'employee' ->> 'employmentId')::uuid;
  if not found then raise exception 'PLACEMENT_NOT_FOUND' using errcode = 'P0002'; end if;

  correlation_id := coalesce(requested_correlation_id, instance_row.correlation_id);
  insert into public.audit_logs (
    tenant_id, administration_id, entity_name, entity_id, actor_user_id, action,
    changes, subject_employee_id, employment_id, correlation_id
  ) values (
    instance_row.tenant_id, instance_row.administration_id, 'employee_organization', placement_id, actor_id, 'CREATE',
    jsonb_build_object('adapterKey','INTERNAL_TRANSFER_ORGANIZATION','current',preview -> 'current','proposed',preview -> 'proposed','effectiveOn',preview ->> 'effectiveOn'),
    (preview -> 'employee' ->> 'id')::uuid,
    (preview -> 'employee' ->> 'employmentId')::uuid,
    correlation_id
  );

  action_result := internal_security.perform_process_work_item_action(
    requested_work_item_id, 'APPROVE', requested_expected_version,
    requested_step_expected_version, btrim(requested_idempotency_key), correlation_id
  );
  result_json := action_result || jsonb_build_object(
    'adapterKey','INTERNAL_TRANSFER_ORGANIZATION',
    'organizationPlacementId',placement_id,
    'preview',preview,
    'writesPerformed',true,
    'correlationId',correlation_id
  );
  insert into public.process_domain_commits (
    tenant_id, hr_group_id, process_instance_id, work_item_id, adapter_key,
    organization_placement_id, correlation_id, idempotency_key, result, created_by_user_id
  ) values (
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, item_row.id, 'INTERNAL_TRANSFER_ORGANIZATION',
    placement_id, correlation_id, btrim(requested_idempotency_key), result_json, actor_id
  );
  return result_json;
end;
$$;


create or replace function internal_security.acknowledge_document_process_work_item_internal(
  requested_work_item_id uuid,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_employee_id uuid;
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  response_row public.process_form_responses%rowtype;
  document_row public.employee_documents%rowtype;
  domain_commit_row public.process_domain_commits%rowtype;
  document_value jsonb;
  document_id_text text;
  resolved_document_id uuid;
  subject_employee_id uuid;
  acknowledgement_id uuid;
  inserted_acknowledgement boolean := false;
  base_result jsonb;
  action_result jsonb;
  final_result jsonb;
begin
  if actor_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if requested_idempotency_key is null or pg_catalog.btrim(requested_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001';
  end if;

  select instance.* into instance_row
  from public.process_instances instance
  join public.process_work_items item
    on item.tenant_id = instance.tenant_id
   and item.hr_group_id = instance.hr_group_id
   and item.process_instance_id = instance.id
   and item.id = requested_work_item_id
  for update of instance;
  if instance_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;

  select item.* into item_row
  from public.process_work_items item
  where item.tenant_id = instance_row.tenant_id
    and item.hr_group_id = instance_row.hr_group_id
    and item.id = requested_work_item_id
  for update;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if item_row.step_key <> 'acknowledge' then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_STEP_INVALID' using errcode = 'P0001'; end if;
  if not exists (
    select 1
    from public.process_recipe_activations activation
    join public.process_recipe_catalog recipe on recipe.id = activation.process_recipe_id
    where activation.tenant_id = instance_row.tenant_id
      and activation.hr_group_id = instance_row.hr_group_id
      and activation.process_definition_id = instance_row.process_definition_id
      and recipe.recipe_key = 'document-acknowledgement'
  ) then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_RECIPE_INVALID' using errcode = 'P0001'; end if;

  actor_employee_id := internal_security.current_employee_id(instance_row.tenant_id, instance_row.hr_group_id);
  select subject.employee_id into subject_employee_id
  from public.process_employee_subjects subject
  where subject.tenant_id = instance_row.tenant_id
    and subject.hr_group_id = instance_row.hr_group_id
    and subject.process_instance_id = instance_row.id;
  if actor_employee_id is null
    or actor_employee_id is distinct from subject_employee_id
    or not internal_security.process_subject_actor_has_permission(
      instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type,
      instance_row.administration_id, subject_employee_id, actor_user_id,
      actor_employee_id, 'self:process-task:act', current_date
    ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select domain_commit.* into domain_commit_row
  from public.process_domain_commits domain_commit
  where domain_commit.tenant_id = instance_row.tenant_id
    and domain_commit.hr_group_id = instance_row.hr_group_id
    and domain_commit.process_instance_id = instance_row.id
    and domain_commit.adapter_key = 'DOCUMENT_ACKNOWLEDGEMENT';
  if domain_commit_row.id is not null then return domain_commit_row.result; end if;

  if actor_employee_id is null or actor_employee_id is distinct from subject_employee_id
    or not internal_security.process_subject_actor_has_permission(
      instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type,
      instance_row.administration_id, subject_employee_id, actor_user_id,
      actor_employee_id, 'self:process-task:act', current_date
    ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if item_row.status not in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then
    raise exception 'WORK_ITEM_NOT_OPEN' using errcode = 'P0001';
  end if;
  if item_row.expected_version <> requested_expected_version then raise exception 'STALE_STATE' using errcode = 'P0001'; end if;

  select response.* into response_row
  from public.process_form_responses response
  where response.tenant_id = item_row.tenant_id
    and response.hr_group_id = item_row.hr_group_id
    and response.work_item_id = item_row.id
  for update;
  if response_row.id is null then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_FORM_MISSING' using errcode = 'P0001'; end if;
  if requested_step_expected_version is not null and requested_step_expected_version <> (
    select step.expected_version
    from public.process_step_instances step
    where step.tenant_id = item_row.tenant_id
      and step.hr_group_id = item_row.hr_group_id
      and step.id = item_row.step_instance_id
  ) then raise exception 'STALE_STATE' using errcode = 'P0001'; end if;
  if coalesce(response_row.new_values -> 'acknowledged', 'false'::jsonb) <> 'true'::jsonb then
    raise exception 'DOCUMENT_ACKNOWLEDGEMENT_CONFIRMATION_REQUIRED' using errcode = 'P0001';
  end if;

  document_value := coalesce(response_row.current_values -> 'document', response_row.new_values -> 'document');
  document_id_text := coalesce(document_value ->> 'id', document_value #>> '{}');
  if document_id_text is null or document_id_text !~* '^[0-9a-f-]{36}$' then
    raise exception 'DOCUMENT_ACKNOWLEDGEMENT_DOCUMENT_REQUIRED' using errcode = 'P0001';
  end if;
  resolved_document_id := document_id_text::uuid;
  select subject.employee_id into subject_employee_id
  from public.process_employee_subjects subject
  where subject.tenant_id = instance_row.tenant_id
    and subject.hr_group_id = instance_row.hr_group_id
    and subject.process_instance_id = instance_row.id;
  select document.* into document_row
  from public.employee_documents document
  where document.tenant_id = instance_row.tenant_id
    and document.administration_id = instance_row.administration_id
    and document.id = resolved_document_id
    and document.employee_id = subject_employee_id
    and document.deleted_at is null
    and exists (
      select 1 from public.document_audiences audience
      where audience.tenant_id = document.tenant_id
        and audience.administration_id = document.administration_id
        and audience.document_id = document.id
        and audience.target_type = 'EMPLOYEE'::public.document_target_type
        and audience.target_employee_id = subject_employee_id
    );
  if document_row.id is null then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_DOCUMENT_NOT_FOUND' using errcode = 'P0002'; end if;

  insert into public.employee_document_acknowledgements (
    tenant_id, hr_group_id, administration_id, employee_id, document_id,
    process_instance_id, work_item_id, acknowledged_by_user_id,
    document_checksum_sha256
  ) values (
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.administration_id, subject_employee_id, document_row.id,
    instance_row.id, item_row.id, actor_user_id, document_row.checksum_sha256
  ) on conflict (tenant_id, hr_group_id, employee_id, document_id) do nothing
  returning id into acknowledgement_id;
  inserted_acknowledgement := acknowledgement_id is not null;
  if acknowledgement_id is null then
    select acknowledgement.id into acknowledgement_id
    from public.employee_document_acknowledgements acknowledgement
    where acknowledgement.tenant_id = instance_row.tenant_id
      and acknowledgement.hr_group_id = instance_row.hr_group_id
      and acknowledgement.employee_id = subject_employee_id
      and acknowledgement.document_id = document_row.id;
  end if;

  update public.process_form_responses
  set status = 'SUBMITTED'
  where id = response_row.id;

  base_result := jsonb_build_object(
    'adapterKey', 'DOCUMENT_ACKNOWLEDGEMENT',
    'acknowledgementId', acknowledgement_id,
    'documentId', document_row.id,
    'documentTitle', document_row.title,
    'documentChecksumSha256', document_row.checksum_sha256,
    'alreadyAcknowledged', not inserted_acknowledgement,
    'writesPerformed', inserted_acknowledgement
  );
  insert into public.process_domain_commits (
    tenant_id, hr_group_id, process_instance_id, work_item_id, adapter_key,
    correlation_id, idempotency_key, result, created_by_user_id
  ) values (
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, item_row.id, 'DOCUMENT_ACKNOWLEDGEMENT',
    coalesce(requested_correlation_id, instance_row.correlation_id), pg_catalog.btrim(requested_idempotency_key), base_result, actor_user_id
  ) on conflict (process_instance_id, adapter_key) do nothing
  returning * into domain_commit_row;
  if domain_commit_row.id is null then
    select domain_commit.* into domain_commit_row
    from public.process_domain_commits domain_commit
    where domain_commit.tenant_id = instance_row.tenant_id
      and domain_commit.hr_group_id = instance_row.hr_group_id
      and domain_commit.process_instance_id = instance_row.id
      and domain_commit.adapter_key = 'DOCUMENT_ACKNOWLEDGEMENT';
    return domain_commit_row.result;
  end if;

  action_result := internal_security.perform_process_work_item_action(
    item_row.id,
    'ACKNOWLEDGE',
    requested_expected_version,
    requested_step_expected_version,
    requested_idempotency_key,
    requested_correlation_id
  );
  final_result := action_result || base_result;
  update public.process_domain_commits
  set result = final_result
  where id = domain_commit_row.id;
  return final_result;
end;
$$;


create or replace function internal_security.get_document_acknowledgement_document_internal(requested_work_item_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor_user_id uuid := auth.uid();
  actor_employee_id uuid;
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  response_row public.process_form_responses%rowtype;
  document_row public.employee_documents%rowtype;
  document_value jsonb;
  document_id_text text;
  document_id uuid;
  subject_employee_id uuid;
begin
  if actor_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select item.* into item_row from public.process_work_items item where item.id = requested_work_item_id;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  select instance.* into instance_row from public.process_instances instance where instance.tenant_id = item_row.tenant_id and instance.hr_group_id = item_row.hr_group_id and instance.id = item_row.process_instance_id;
  actor_employee_id := internal_security.current_employee_id(instance_row.tenant_id, instance_row.hr_group_id);
  select subject.employee_id into subject_employee_id
  from public.process_employee_subjects subject
  where subject.tenant_id = instance_row.tenant_id
    and subject.hr_group_id = instance_row.hr_group_id
    and subject.process_instance_id = instance_row.id;
  if actor_employee_id is null or actor_employee_id is distinct from subject_employee_id
    or not internal_security.process_subject_actor_has_permission(
      instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type,
      instance_row.administration_id, subject_employee_id, actor_user_id,
      actor_employee_id, 'self:process-task:read', current_date
    ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select response.* into response_row from public.process_form_responses response where response.tenant_id = item_row.tenant_id and response.hr_group_id = item_row.hr_group_id and response.work_item_id = item_row.id;
  document_value := coalesce(response_row.current_values -> 'document', response_row.new_values -> 'document');
  document_id_text := coalesce(document_value ->> 'id', document_value #>> '{}');
  if document_id_text is null or document_id_text !~* '^[0-9a-f-]{36}$' then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_DOCUMENT_REQUIRED' using errcode = 'P0001'; end if;
  document_id := document_id_text::uuid;
  select subject.employee_id into subject_employee_id from public.process_employee_subjects subject where subject.tenant_id = instance_row.tenant_id and subject.hr_group_id = instance_row.hr_group_id and subject.process_instance_id = instance_row.id;
  select document.* into document_row from public.employee_documents document where document.tenant_id = instance_row.tenant_id and document.administration_id = instance_row.administration_id and document.id = document_id and document.employee_id = subject_employee_id and document.deleted_at is null;
  if document_row.id is null then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_DOCUMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  return jsonb_build_object('documentId', document_row.id, 'employeeId', subject_employee_id, 'title', document_row.title, 'originalFilename', document_row.original_filename, 'contentType', document_row.content_type, 'checksumSha256', document_row.checksum_sha256, 'acknowledged', exists (select 1 from public.employee_document_acknowledgements acknowledgement where acknowledgement.process_instance_id = instance_row.id and acknowledgement.document_id = document_row.id));
end;
$$;

do $wvp_hardening$
begin
  if to_regprocedure('internal_security.wvp_case_access(public.absence_cases,boolean)') is not null then
    execute $wvp_function$
      create or replace function internal_security.wvp_case_access(c public.absence_cases, writing boolean default false)
      returns boolean
      language plpgsql
      stable
      security definer
      set search_path = ''
      as $function$
      declare
        actor_employee_id uuid := internal_security.current_employee_id(c.tenant_id, c.hr_group_id);
      begin
        if c.archived_at is not null or auth.uid() is null then return false; end if;
        if writing then
          return internal_security.process_user_has_scoped_permission(
            c.tenant_id, c.hr_group_id, 'ADMINISTRATION'::public.access_scope_type,
            c.administration_id, auth.uid(), 'absence:write', array['TENANT_ADMIN', 'HR_ADMIN']::text[]
          ) or internal_security.process_manager_has_subject_permission(
            c.tenant_id, c.hr_group_id, c.administration_id, c.employee_id, auth.uid(),
            actor_employee_id, 'absence:write', current_date
          );
        end if;
        if c.employee_id = actor_employee_id
          and internal_security.current_employee_is_preboarding(c.tenant_id, c.hr_group_id) then
          return false;
        end if;
        return internal_security.process_subject_actor_has_permission(
          c.tenant_id, c.hr_group_id, 'ADMINISTRATION'::public.access_scope_type,
          c.administration_id, c.employee_id, auth.uid(), actor_employee_id,
          'absence:read', current_date
        );
      end;
      $function$;
    $wvp_function$;
  end if;
end;
$wvp_hardening$;

commit;
