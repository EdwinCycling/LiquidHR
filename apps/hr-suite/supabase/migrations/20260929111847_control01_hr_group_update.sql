-- CONVERGENCE_REQUIRED
-- Platform operators may edit only the HR-group name and description.
-- The immutable code and the tenant/group association remain unchanged.
begin;

create or replace function internal_security.update_platform_hr_group(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_name text,
  requested_description text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  existing_name text;
  existing_description text;
  next_name text;
  next_description text;
begin
  if not internal_security.is_platform_operator(array[
    'OWNER'::public.platform_operator_role,
    'OPERATOR'::public.platform_operator_role
  ]) then
    raise exception 'PLATFORM_WRITE_ACCESS_DENIED' using errcode = '42501';
  end if;

  next_name := btrim(coalesce(requested_name, ''));
  next_description := nullif(btrim(coalesce(requested_description, '')), '');

  if requested_tenant_id is null
     or requested_hr_group_id is null
     or next_name = ''
     or length(next_name) > 160
     or length(coalesce(next_description, '')) > 1000 then
    raise exception 'INVALID_HR_GROUP_INPUT' using errcode = '22023';
  end if;

  select group_row.name, group_row.description
  into existing_name, existing_description
  from public.hr_groups as group_row
  where group_row.id = requested_hr_group_id
    and group_row.tenant_id = requested_tenant_id
  for update;

  if not found then
    raise exception 'HR_GROUP_NOT_FOUND' using errcode = 'P0002';
  end if;

  if existing_name is distinct from next_name
     or existing_description is distinct from next_description then
    update public.hr_groups as group_row
    set name = next_name,
        description = next_description,
        updated_by_user_id = auth.uid(),
        updated_at = now()
    where group_row.id = requested_hr_group_id
      and group_row.tenant_id = requested_tenant_id;

    insert into public.platform_audit_logs (
      tenant_id,
      actor_user_id,
      action,
      reason,
      before_state,
      after_state
    )
    values (
      requested_tenant_id,
      auth.uid(),
      'HR_GROUP_UPDATED',
      'HR-groep bijgewerkt vanuit de Control Plane.',
      jsonb_build_object(
        'id', requested_hr_group_id,
        'name', existing_name,
        'description', existing_description
      ),
      jsonb_build_object(
        'id', requested_hr_group_id,
        'name', next_name,
        'description', next_description
      )
    );
  end if;

  return requested_hr_group_id;
end;
$function$;

revoke all on function internal_security.update_platform_hr_group(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function internal_security.update_platform_hr_group(uuid, uuid, text, text) to authenticated;

create function public.update_platform_hr_group(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_name text,
  requested_description text default null
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $function$
  select internal_security.update_platform_hr_group(
    requested_tenant_id,
    requested_hr_group_id,
    requested_name,
    requested_description
  );
$function$;

revoke all on function public.update_platform_hr_group(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.update_platform_hr_group(uuid, uuid, text, text) to authenticated;

commit;