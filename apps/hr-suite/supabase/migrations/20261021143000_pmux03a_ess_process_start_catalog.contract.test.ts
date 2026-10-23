import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(new URL('./20261021143000_pmux03a_ess_process_start_catalog.sql', import.meta.url), 'utf8')
const migration = migrationSource
const normalizedMigration = migrationSource.toLowerCase()

describe('PMUX-03A startable process catalog migration', () => {
  it('keeps published version metadata behind an authenticated permission-filtered RPC', () => {
    expect(migration).toContain('security definer')
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain('auth.uid() is null')
    expect(migration).toContain('internal_security.current_employee_id(requested_tenant_id, requested_hr_group_id)')
    expect(migration).toContain("definition.status = 'PUBLISHED'::public.process_definition_status")
    expect(migration).toContain('order by version.version_number desc')
    expect(migration).toContain("'process-instance:start'")
    expect(migration).toContain("'self:process-instance:start'")
    expect(migration).toContain('employee.auth_user_id = auth.uid()')
  })

  it('does not grant table reads and filters native starter processes', () => {
    expect(migration).toContain("definition.key not in ('internal-transfer', 'document-acknowledgement', 'leave-request')")
    expect(migration).toContain("recipe.recipe_key in ('internal-transfer', 'document-acknowledgement', 'leave-request')")
    expect(migration).not.toMatch(/grant\s+select\s+on\s+(?:table\s+)?public\.process_(?:definitions|versions)/i)
    expect(migration).toContain('revoke all on function public.get_process_startable_catalog(uuid, uuid) from public, anon')
    expect(migration).toContain('grant execute on function public.get_process_startable_catalog(uuid, uuid) to authenticated')
    expect(migration).toContain('LOCAL ONLY')
  })

  it('keeps the internal helper ungranted and exposes only an authenticated security-definer wrapper', () => {
    expect(migration).toContain('revoke all on function internal_security.get_process_startable_catalog_internal(uuid, uuid)')
    expect(normalizedMigration).not.toMatch(/grant\s+execute\s+on\s+function\s+internal_security\.get_process_startable_catalog_internal/i)
    expect(normalizedMigration).toContain('security invoker')
    expect(normalizedMigration).toMatch(/create or replace function public\.get_process_startable_catalog\([\s\S]*?security definer[\s\S]*?set search_path = ''/)
    expect(normalizedMigration).toContain('revoke all on function public.get_process_startable_catalog(uuid, uuid) from public, anon, authenticated')
    expect(normalizedMigration).toContain('grant execute on function public.get_process_startable_catalog(uuid, uuid) to authenticated')
  })

  it('returns human-readable version-pinned step and route labels without internal keys', () => {
    expect(migration).toContain("'title', step.value -> 'title'")
    expect(migration).toContain("'responsibleRole', participant.label")
    expect(migration).toContain("'fromTitle', from_step.value -> 'title'")
    expect(migration).toContain("'toTitle', to_step.value -> 'title'")
    expect(migration).not.toContain("'stepKey'")
    expect(migration).not.toContain("'participantKey',")
  })

  it('executes the migration with guarded grants, auth.uid actor binding, and published/startable filtering', async () => {
    const db = new PGlite()
    const ids = {
      actor: '00000000-0000-4000-8000-000000000001',
      employee: '00000000-0000-4000-8000-000000000002',
      otherActor: '00000000-0000-4000-8000-000000000003',
      otherEmployee: '00000000-0000-4000-8000-000000000004',
      tenantA: '00000000-0000-4000-8000-000000000010',
      tenantB: '00000000-0000-4000-8000-000000000011',
      groupA: '00000000-0000-4000-8000-000000000020',
      groupB: '00000000-0000-4000-8000-000000000021',
      published: '00000000-0000-4000-8000-000000000030',
      unpublished: '00000000-0000-4000-8000-000000000031',
      notStartable: '00000000-0000-4000-8000-000000000032',
      otherTenantDefinition: '00000000-0000-4000-8000-000000000033',
      administrationStartable: '00000000-0000-4000-8000-000000000034',
      versionOne: '00000000-0000-4000-8000-000000000040',
      versionTwo: '00000000-0000-4000-8000-000000000041',
      versionUnpublished: '00000000-0000-4000-8000-000000000042',
      versionNotStartable: '00000000-0000-4000-8000-000000000043',
      versionOtherTenant: '00000000-0000-4000-8000-000000000044',
      versionAdministrationStartable: '00000000-0000-4000-8000-000000000045',
    }
    const content = (title: string) => JSON.stringify({
      title: { nl: title, en: title },
      description: { nl: 'Veilig testproces', en: 'Safe test process' },
      startStepKey: 'request',
      steps: [{ key: 'request', title: { nl: 'Aanvragen', en: 'Request' }, participantKey: 'employee' }],
      participants: [{ key: 'employee', label: { nl: 'Medewerker', en: 'Employee' } }],
      transitions: [],
    })

    try {
      try {
        await db.exec(`
        create role authenticated;
        create role anon;
        create schema auth;
        create function auth.uid() returns uuid language sql stable
          as $$ select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        create schema internal_security;
        grant usage on schema internal_security to authenticated;

        create type public.process_definition_status as enum ('DRAFT', 'PUBLISHED');
        create type public.access_scope_type as enum ('TENANT', 'ADMINISTRATION');
        create table public.employees (
          id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
          auth_user_id uuid not null, deleted_at timestamptz, is_active boolean not null
        );
        create table public.process_definitions (
          id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
          status public.process_definition_status not null, key text not null,
          scope_type public.access_scope_type not null, administration_id uuid
        );
        create table public.process_versions (
          id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
          process_definition_id uuid not null, version_number integer not null, definition_json jsonb not null
        );
        create table public.process_recipe_activations (
          tenant_id uuid not null, hr_group_id uuid not null, process_definition_id uuid not null,
          process_recipe_id uuid not null
        );
        create table public.process_recipe_catalog (id uuid primary key, recipe_key text not null);
        create table public.employments (
          tenant_id uuid not null, hr_group_id uuid not null, administration_id uuid not null,
          employee_id uuid not null, deleted_at timestamptz, starts_on date not null, ends_on date
        );
        create table internal_security.permission_fixtures (
          actor_user_id uuid not null, tenant_id uuid not null, hr_group_id uuid not null,
          scope_type public.access_scope_type not null, administration_id uuid,
          permission_code text not null
        );

        create function internal_security.current_employee_id(requested_tenant_id uuid, requested_hr_group_id uuid)
          returns uuid language sql stable security definer set search_path = '' as $$
            select employee.id from public.employees employee
            where employee.tenant_id = requested_tenant_id
              and employee.hr_group_id = requested_hr_group_id
              and employee.auth_user_id = auth.uid()
              and employee.deleted_at is null and employee.is_active
            order by employee.id limit 1
          $$;
        create function internal_security.process_scope_has_permission(
          requested_tenant_id uuid, requested_hr_group_id uuid,
          requested_scope_type public.access_scope_type, requested_administration_id uuid,
          requested_permission_code text
        ) returns boolean language sql stable security definer set search_path = '' as $$
          select exists (
            select 1 from internal_security.permission_fixtures permission
            where permission.actor_user_id = auth.uid()
              and permission.tenant_id = requested_tenant_id
              and permission.hr_group_id = requested_hr_group_id
              and permission.scope_type = requested_scope_type
              and permission.administration_id is not distinct from requested_administration_id
              and permission.permission_code = requested_permission_code
          )
        $$;
        create function internal_security.process_definition_content(requested_definition jsonb)
          returns jsonb language sql immutable security definer set search_path = '' as $$
            select case when pg_catalog.jsonb_typeof(requested_definition -> 'content') = 'object'
              then requested_definition -> 'content' else requested_definition end
          $$;

        insert into public.employees values
          ('${ids.employee}', '${ids.tenantA}', '${ids.groupA}', '${ids.actor}', null, true),
          ('${ids.otherEmployee}', '${ids.tenantB}', '${ids.groupB}', '${ids.otherActor}', null, true);
        insert into internal_security.permission_fixtures values
          ('${ids.actor}', '${ids.tenantA}', '${ids.groupA}', 'TENANT', null, 'self:process-instance:start'),
          ('${ids.actor}', '${ids.tenantA}', '${ids.groupA}', 'ADMINISTRATION', '00000000-0000-4000-8000-000000000046', 'process-instance:start');
        insert into public.process_definitions values
          ('${ids.published}', '${ids.tenantA}', '${ids.groupA}', 'PUBLISHED', 'training-request', 'TENANT', null),
          ('${ids.unpublished}', '${ids.tenantA}', '${ids.groupA}', 'DRAFT', 'draft-only', 'TENANT', null),
          ('${ids.notStartable}', '${ids.tenantA}', '${ids.groupA}', 'PUBLISHED', 'not-startable', 'ADMINISTRATION', '00000000-0000-4000-8000-000000000045'),
          ('${ids.otherTenantDefinition}', '${ids.tenantB}', '${ids.groupB}', 'PUBLISHED', 'other-tenant', 'TENANT', null),
          ('${ids.administrationStartable}', '${ids.tenantA}', '${ids.groupA}', 'PUBLISHED', 'administration-startable', 'ADMINISTRATION', '00000000-0000-4000-8000-000000000046');
        insert into public.process_versions values
          ('${ids.versionOne}', '${ids.tenantA}', '${ids.groupA}', '${ids.published}', 1, '${content('Opleidingsaanvraag v1')}'::jsonb),
          ('${ids.versionTwo}', '${ids.tenantA}', '${ids.groupA}', '${ids.published}', 2, '${content('Opleidingsaanvraag v2')}'::jsonb),
          ('${ids.versionUnpublished}', '${ids.tenantA}', '${ids.groupA}', '${ids.unpublished}', 1, '${content('Concept')}'::jsonb),
          ('${ids.versionNotStartable}', '${ids.tenantA}', '${ids.groupA}', '${ids.notStartable}', 1, '${content('Niet startbaar')}'::jsonb),
          ('${ids.versionOtherTenant}', '${ids.tenantB}', '${ids.groupB}', '${ids.otherTenantDefinition}', 1, '${content('Andere tenant')}'::jsonb),
          ('${ids.versionAdministrationStartable}', '${ids.tenantA}', '${ids.groupA}', '${ids.administrationStartable}', 1, '${content('Administratieaanvraag')}'::jsonb);
        insert into public.employments values
          ('${ids.tenantA}', '${ids.groupA}', '00000000-0000-4000-8000-000000000045', '${ids.employee}', null, date '2000-01-01', null),
          ('${ids.tenantA}', '${ids.groupA}', '00000000-0000-4000-8000-000000000046', '${ids.employee}', null, date '2000-01-01', null);
        `)
      } catch (error) {
        throw new Error(`PGlite fixture setup failed: ${String(error)}`, { cause: error })
      }
      try {
        await db.exec(migrationSource)
      } catch (error) {
        const position = Number((error as { position?: string }).position)
        const context = Number.isFinite(position)
          ? migrationSource.slice(Math.max(0, position - 180), position + 180)
          : ''
        throw new Error(`PGlite migration execution failed: ${String(error)} near ${context}`, { cause: error })
      }

      const privileges = await db.query<{ can_execute_internal: boolean }>(`
        select has_function_privilege(
          'authenticated',
          'internal_security.get_process_startable_catalog_internal(uuid, uuid)',
          'EXECUTE'
        ) as can_execute_internal
      `)
      expect(privileges.rows[0]?.can_execute_internal).toBe(false)

      await db.exec(`
        select pg_catalog.set_config('request.jwt.claim.sub', '${ids.actor}', false);
        set role authenticated;
      `)
      const result = await db.query<{ catalog: Array<{ processDefinitionId: string; title: { nl: string } }> }>(
        'select public.get_process_startable_catalog($1, $2) as catalog',
        [ids.tenantA, ids.groupA],
      )
      const catalog = result.rows[0]?.catalog ?? []
      expect(catalog).toHaveLength(2)
      expect(catalog).toContainEqual(expect.objectContaining({
        processDefinitionId: ids.published,
        title: expect.objectContaining({ nl: 'Opleidingsaanvraag v2' }),
      }))
      expect(catalog).toContainEqual(expect.objectContaining({
        processDefinitionId: ids.administrationStartable,
        title: expect.objectContaining({ nl: 'Administratieaanvraag' }),
      }))
      expect(catalog.some((definition) => definition.processDefinitionId === ids.notStartable)).toBe(false)
      expect(catalog.some((definition) => definition.processDefinitionId === ids.unpublished)).toBe(false)
      expect(catalog.some((definition) => definition.processDefinitionId === ids.otherTenantDefinition)).toBe(false)
      await expect(
        db.query('select internal_security.get_process_startable_catalog_internal($1, $2)', [ids.tenantA, ids.groupA]),
      ).rejects.toThrow(/permission denied/i)
      await expect(
        db.query('select public.get_process_startable_catalog($1, $2)', [ids.tenantB, ids.groupB]),
      ).rejects.toThrow(/ACTOR_EMPLOYEE_NOT_FOUND/)
      await expect(
        db.query('select public.get_process_startable_catalog($1, $2)', [ids.tenantA, ids.groupB]),
      ).rejects.toThrow(/ACTOR_EMPLOYEE_NOT_FOUND/)
      await db.exec(`select pg_catalog.set_config('request.jwt.claim.sub', '', false)`)
      await expect(
        db.query('select public.get_process_startable_catalog($1, $2)', [ids.tenantA, ids.groupA]),
      ).rejects.toThrow(/AUTHENTICATION_REQUIRED/)
      await db.exec('reset role; set role anon')
      await expect(
        db.query('select public.get_process_startable_catalog($1, $2)', [ids.tenantA, ids.groupA]),
      ).rejects.toThrow(/permission denied/i)
    } finally {
      await db.close()
    }
  })
})
