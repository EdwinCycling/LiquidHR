import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const migrationDirectory = new URL('.', import.meta.url)
const hrAdminPermissionMigration = readFileSync(
  new URL('./20260808180712_process_automation_p6_role_permissions.sql', migrationDirectory),
  'utf8',
)
const administrationPermissionSource = readFileSync(
  new URL('./20260714174305_add_multitenancy_administrations.sql', migrationDirectory),
  'utf8',
)
const hrGroupPermissionSource = readFileSync(
  new URL('./20260805163920_hr_group_context_and_control_plane.sql', migrationDirectory),
  'utf8',
)
const processScopeSource = readFileSync(
  new URL('./20260808122825_process_automation_p2_foundation.sql', migrationDirectory),
  'utf8',
)

function extractFunctionDefinition(source: string, functionName: string): string {
  const start = source.toLowerCase().indexOf(`create or replace function ${functionName.toLowerCase()}(`)
  if (start < 0) throw new Error(`Expected function not found: ${functionName}`)
  const endMarker = '\n$$;'
  const end = source.indexOf(endMarker, start)
  if (end < 0) throw new Error(`Expected function terminator not found: ${functionName}`)
  return source.slice(start, end + endMarker.length)
}

describe('PMUX-04-SEC HR Admin process-task scope', () => {
  it('grants HR Admin task permissions within its tenant and denies other-tenant scope', async () => {
    const db = new PGlite()
    const ids = {
      actor: '00000000-0000-4000-8000-000000000001',
      tenantA: '00000000-0000-4000-8000-000000000010',
      tenantB: '00000000-0000-4000-8000-000000000011',
      groupA1: '00000000-0000-4000-8000-000000000020',
      groupA2: '00000000-0000-4000-8000-000000000021',
      groupB: '00000000-0000-4000-8000-000000000022',
      administrationA1: '00000000-0000-4000-8000-000000000030',
      administrationA2: '00000000-0000-4000-8000-000000000031',
      administrationB: '00000000-0000-4000-8000-000000000032',
      hrAdminRole: '00000000-0000-4000-8000-000000000040',
      otherTenantRole: '00000000-0000-4000-8000-000000000041',
    }

    try {
      await db.exec(`
        create role authenticated;
        create role anon;
        create schema auth;
        create function auth.uid() returns uuid language sql stable
          as $$ select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        create schema internal_security;
        grant usage on schema internal_security to authenticated;
        create type public.access_scope_type as enum ('TENANT', 'ADMINISTRATION');

        create table public.management_roles (id uuid primary key, code text not null, tenant_id uuid);
        create table public.permissions (id uuid primary key, code text not null unique);
        create table public.role_permissions (
          management_role_id uuid not null, permission_id uuid not null,
          primary key (management_role_id, permission_id)
        );
        create table public.user_access (
          user_id uuid not null, tenant_id uuid not null, management_role_id uuid not null,
          is_active boolean not null, scope_type text not null, administration_id uuid
        );
        create table public.user_hr_group_access (
          user_id uuid not null, tenant_id uuid not null, hr_group_id uuid not null,
          management_role_id uuid not null, is_active boolean not null
        );
        create table public.hr_groups (tenant_id uuid not null, id uuid not null, is_active boolean not null);

        insert into public.management_roles values
          ('${ids.hrAdminRole}', 'HR_ADMIN', '${ids.tenantA}'),
          ('${ids.otherTenantRole}', 'HR_ADMIN', '${ids.tenantB}');
        insert into public.permissions (id, code)
        select gen_random_uuid(), permission.code
        from (values
          ('process-definition:read'), ('process-definition:write'), ('process-definition:publish'),
          ('form-definition:read'), ('form-definition:write'), ('form-definition:publish'),
          ('process-instance:read'), ('process-instance:start'), ('process-instance:cancel'),
          ('process-task:read'), ('process-task:act'), ('process-task:reassign'),
          ('process-operations:read'), ('process-operations:write')
        ) as permission(code);
        insert into public.user_access values
          ('${ids.actor}', '${ids.tenantA}', '${ids.hrAdminRole}', true, 'TENANT', null);
        insert into public.user_hr_group_access values
          ('${ids.actor}', '${ids.tenantA}', '${ids.groupA1}', '${ids.hrAdminRole}', true),
          ('${ids.actor}', '${ids.tenantA}', '${ids.groupA2}', '${ids.hrAdminRole}', true);
        insert into public.hr_groups values
          ('${ids.tenantA}', '${ids.groupA1}', true),
          ('${ids.tenantA}', '${ids.groupA2}', true),
          ('${ids.tenantB}', '${ids.groupB}', true);
      `)

      await db.exec(hrAdminPermissionMigration)
      await db.exec(extractFunctionDefinition(
        administrationPermissionSource,
        'internal_security.current_user_has_permission',
      ))
      await db.exec(extractFunctionDefinition(
        hrGroupPermissionSource,
        'internal_security.current_user_has_hr_group_permission',
      ))
      await db.exec(extractFunctionDefinition(
        processScopeSource,
        'internal_security.process_scope_has_permission',
      ))
      await db.exec(`
        revoke all on function internal_security.process_scope_has_permission(uuid, uuid, public.access_scope_type, uuid, text)
          from public, anon, authenticated;
        grant execute on function internal_security.process_scope_has_permission(uuid, uuid, public.access_scope_type, uuid, text)
          to authenticated;
      `)
      const permissionGrant = await db.query<{ can_read: boolean; can_act: boolean }>(`
        select bool_or(permission.code = 'process-task:read') as can_read,
          bool_or(permission.code = 'process-task:act') as can_act
        from public.role_permissions role_permission
        join public.management_roles role on role.id = role_permission.management_role_id
        join public.permissions permission on permission.id = role_permission.permission_id
        where role.id = '${ids.hrAdminRole}'
          and permission.code in ('process-task:read', 'process-task:act')
      `)
      expect(permissionGrant.rows[0]).toMatchObject({ can_read: true, can_act: true })

      await db.exec(`
        select pg_catalog.set_config('request.jwt.claim.sub', '${ids.actor}', false);
        set role authenticated;
      `)

      const scopes = await db.query<{ scope_name: string; allowed: boolean }>(`
        select * from (values
          ('task read', internal_security.process_scope_has_permission(
            '${ids.tenantA}', '${ids.groupA1}', 'ADMINISTRATION', '${ids.administrationA1}', 'process-task:read')),
          ('tenant admin one', internal_security.process_scope_has_permission(
            '${ids.tenantA}', '${ids.groupA1}', 'ADMINISTRATION', '${ids.administrationA1}', 'process-task:act')),
          ('tenant admin two', internal_security.process_scope_has_permission(
            '${ids.tenantA}', '${ids.groupA2}', 'ADMINISTRATION', '${ids.administrationA2}', 'process-task:act')),
          ('same-tenant group two', internal_security.process_scope_has_permission(
            '${ids.tenantA}', '${ids.groupA2}', 'TENANT', null, 'process-task:act')),
          ('other tenant admin', internal_security.process_scope_has_permission(
            '${ids.tenantB}', '${ids.groupB}', 'ADMINISTRATION', '${ids.administrationB}', 'process-task:act')),
          ('other tenant group', internal_security.process_scope_has_permission(
            '${ids.tenantB}', '${ids.groupB}', 'TENANT', null, 'process-task:act'))
        ) as scope_result(scope_name, allowed)
      `)
      expect(scopes.rows).toEqual([
        { scope_name: 'task read', allowed: true },
        { scope_name: 'tenant admin one', allowed: true },
        { scope_name: 'tenant admin two', allowed: true },
        { scope_name: 'same-tenant group two', allowed: true },
        { scope_name: 'other tenant admin', allowed: false },
        { scope_name: 'other tenant group', allowed: false },
      ])
    } finally {
      await db.close()
    }
  })
})
