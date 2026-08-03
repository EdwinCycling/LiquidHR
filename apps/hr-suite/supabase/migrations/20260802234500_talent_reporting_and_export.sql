begin;

alter table public.audit_logs drop constraint if exists audit_logs_action_check;
alter table public.audit_logs
  add constraint audit_logs_action_check
  check (action in ('CREATE', 'UPDATE', 'ARCHIVE', 'DELETE', 'REVEAL', 'EXPORT'));

insert into public.permissions (code, name, description, category)
values
  ('talent-report:read', 'Talentrapportages lezen', 'Leest de toegestane Talentrapportage binnen de actuele scope.', 'Talent'),
  ('talent-export:read', 'Talent exporteren', 'Exporteert toegestane Talentgegevens binnen de actuele scope.', 'Talent'),
  ('self:talent-report:read', 'Eigen Talentrapportage lezen', 'Leest de eigen Talentrapportage.', 'Talent'),
  ('self:talent-export:read', 'Eigen Talent exporteren', 'Exporteert uitsluitend eigen Talentgegevens.', 'Talent')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and (
    (role.code in ('TENANT_ADMIN', 'DIRECT_MANAGER') and permission.code in ('talent-report:read', 'talent-export:read'))
    or (role.code = 'EMPLOYEE' and permission.code in ('self:talent-report:read', 'self:talent-export:read'))
  )
on conflict do nothing;

create policy audit_logs_insert_talent_export
on public.audit_logs for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and action = 'EXPORT'
  and entity_name = 'talent_export'
  and entity_id = tenant_id
  and jsonb_typeof(changes) = 'object'
  and changes ->> 'format' = 'csv'
  and jsonb_typeof(changes -> 'record_count') = 'number'
  and (changes ->> 'record_count')::integer >= 0
  and changes ->> 'scope' in ('admin', 'manager', 'self')
  and (
    ((changes ->> 'scope') = 'self' and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-export:read')))
    or ((changes ->> 'scope') in ('admin', 'manager') and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-export:read')))
  )
);

grant insert (
  tenant_id, administration_id, entity_name, entity_id,
  actor_user_id, action, changes
) on public.audit_logs to authenticated;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.tenants tenant on tenant.id = role.tenant_id
cross join public.permissions permission
where tenant.slug = 'liquid-hr-demo-holding'
  and (
    (role.code in ('TENANT_ADMIN', 'DIRECT_MANAGER') and permission.code in ('talent-report:read', 'talent-export:read'))
    or (role.code = 'EMPLOYEE' and permission.code in ('self:talent-report:read', 'self:talent-export:read'))
  )
on conflict do nothing;

commit;
