begin;

-- De effectieve tenant-HR-adminrol moet de eigen groepscontext ook kunnen
-- lezen; de UI kan anders de beheerkaart niet openen.
insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'TENANT_ADMIN'
  and permission.code = 'hr-group:read'
on conflict do nothing;

commit;
