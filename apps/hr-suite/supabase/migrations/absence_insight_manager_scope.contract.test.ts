import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'

const casesPolicyUrl = new URL('./20260726150000_add_absence_core.sql', import.meta.url)
const selfPolicyUrl = new URL('./20260804142227_employee_absence_read_access.sql', import.meta.url)
const leavePolicyUrl = new URL('./20260914142023_leave_insights_manager_permission.sql', import.meta.url)
const authorizationHelperUrl = new URL('./20260917172549_focus_identity_preboarding_access.sql', import.meta.url)
const teamScopeUrl = new URL('../../lib/organization/team-scope.ts', import.meta.url)
const absenceReportUrl = new URL('../../lib/insights/absence-report.ts', import.meta.url)
const frequentReportUrl = new URL('../../lib/insights/frequent-absence-report.ts', import.meta.url)

const tenantA = '00000000-0000-4000-8000-000000000001'
const groupA = '00000000-0000-4000-8000-000000000011'
const managerUser = '00000000-0000-4000-8000-000000000071'
const directEmployee = '00000000-0000-4000-8000-000000000301'
const groupColleague = '00000000-0000-4000-8000-000000000302'
const otherAdministrationEmployee = '00000000-0000-4000-8000-000000000303'
const otherGroupEmployee = '00000000-0000-4000-8000-000000000304'
const otherTenantEmployee = '00000000-0000-4000-8000-000000000305'

let database: PGlite | null = null

async function createDatabase(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(String.raw`
    create role anon;
    create role authenticated;
    create schema auth;
    create schema internal_security;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    create table public.user_group_permissions (
      user_id uuid not null, tenant_id uuid not null, hr_group_id uuid not null,
      permission_code text not null, role_code text not null, is_active boolean not null default true
    );
    create table public.employees (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      auth_user_id uuid, deleted_at timestamptz
    );
    create table public.employee_organizations (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      administration_id uuid not null, employee_id uuid not null, direct_manager_id uuid,
      effective_from date not null, effective_to date
    );
    create table public.absence_cases (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      administration_id uuid not null, employee_id uuid not null
    );
    create table public.absence_spells (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      case_id uuid not null
    );
    create table public.absence_capacity_changes (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      case_id uuid not null, spell_id uuid not null
    );

    create function internal_security.current_employee_id()
    returns uuid language sql stable security definer set search_path = '' as $$
      select employee.id from public.employees employee
      where employee.auth_user_id = (select auth.uid()) and employee.deleted_at is null
      limit 1
    $$;
    create function internal_security.current_user_has_hr_group_permission(
      requested_tenant_id uuid, requested_hr_group_id uuid, requested_permission_code text
    ) returns boolean language sql stable security definer set search_path = '' as $$
      select exists (
        select 1 from public.user_group_permissions permission_grant
        where permission_grant.user_id = (select auth.uid())
          and permission_grant.tenant_id = requested_tenant_id
          and permission_grant.hr_group_id = requested_hr_group_id
          and permission_grant.permission_code = requested_permission_code
          and permission_grant.is_active
      )
    $$;
    create function internal_security.has_hr_group_access(
      requested_tenant_id uuid, requested_hr_group_id uuid
    ) returns boolean language sql stable security definer set search_path = '' as $$
      select exists (
        select 1 from public.user_group_permissions permission_grant
        where permission_grant.user_id = (select auth.uid())
          and permission_grant.tenant_id = requested_tenant_id
          and permission_grant.hr_group_id = requested_hr_group_id
          and permission_grant.is_active
      )
    $$;
    create function internal_security.current_employee_has_permission(requested_permission_code text)
    returns boolean language sql stable security definer set search_path = '' as $$
      select false
    $$;
    create function internal_security.can_manage_employee(
      target_employee_id uuid, requested_permission_code text
    ) returns boolean language sql stable security definer set search_path = '' as $$
      select exists (
        select 1
        from public.employees target_employee
        join public.employee_organizations placement
          on placement.tenant_id = target_employee.tenant_id
         and placement.hr_group_id = target_employee.hr_group_id
         and placement.employee_id = target_employee.id
        where target_employee.id = target_employee_id
          and target_employee.deleted_at is null
          and placement.effective_from <= current_date
          and (placement.effective_to is null or placement.effective_to >= current_date)
          and (
            internal_security.current_user_has_hr_group_permission(
              placement.tenant_id, placement.hr_group_id, requested_permission_code
            )
            or (
              placement.direct_manager_id = (select internal_security.current_employee_id())
              and internal_security.has_hr_group_access(placement.tenant_id, placement.hr_group_id)
            )
          )
      )
    $$;

    grant usage on schema internal_security to authenticated;
    grant execute on all functions in schema internal_security to authenticated;
    grant select on public.user_group_permissions, public.employees, public.employee_organizations,
      public.absence_cases, public.absence_spells, public.absence_capacity_changes to authenticated;
    alter table public.employee_organizations enable row level security;
    alter table public.absence_cases enable row level security;
    alter table public.absence_spells enable row level security;
    alter table public.absence_capacity_changes enable row level security;

    create policy employee_organizations_group_read on public.employee_organizations
      for select to authenticated using (
        internal_security.has_hr_group_access(tenant_id, hr_group_id)
      );
    create policy absence_cases_select on public.absence_cases
      for select to authenticated using (
        internal_security.can_manage_employee(employee_id, 'absence:read')
        or (
          employee_id = (select internal_security.current_employee_id())
          and internal_security.current_employee_has_permission('self:absence:read')
        )
      );
    create policy leave_insights_absence_cases_read on public.absence_cases
      for select to authenticated using (
        internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read')
        and internal_security.can_manage_employee(employee_id, 'employee:read')
      );
    create policy absence_cases_hr_group_boundary on public.absence_cases
      as restrictive for select to authenticated using (
        internal_security.has_hr_group_access(tenant_id, hr_group_id)
      );
    create policy absence_spells_select on public.absence_spells
      for select to authenticated using (
        exists (
          select 1 from public.absence_cases absence_case
          where absence_case.id = absence_spells.case_id
            and absence_case.tenant_id = absence_spells.tenant_id
            and internal_security.can_manage_employee(absence_case.employee_id, 'absence:read')
        )
      );
    create policy absence_spells_hr_group_boundary on public.absence_spells
      as restrictive for select to authenticated using (
        internal_security.has_hr_group_access(tenant_id, hr_group_id)
      );
    create policy absence_capacity_select on public.absence_capacity_changes
      for select to authenticated using (
        exists (
          select 1 from public.absence_cases absence_case
          where absence_case.id = absence_capacity_changes.case_id
            and absence_case.tenant_id = absence_capacity_changes.tenant_id
            and internal_security.can_manage_employee(absence_case.employee_id, 'absence:read')
        )
      );
    create policy absence_capacity_changes_hr_group_boundary on public.absence_capacity_changes
      as restrictive for select to authenticated using (
        internal_security.has_hr_group_access(tenant_id, hr_group_id)
      );

    insert into public.employees (id, tenant_id, hr_group_id, auth_user_id) values
      ('00000000-0000-4000-8000-000000000171', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000071'),
      ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', null),
      ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', null),
      ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', null),
      ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', null),
      ('00000000-0000-4000-8000-000000000305', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000013', null);
    insert into public.employee_organizations
      (id, tenant_id, hr_group_id, administration_id, employee_id, direct_manager_id, effective_from, effective_to) values
      ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000171', current_date - 1, null),
      ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000999', current_date - 1, null),
      ('00000000-0000-4000-8000-000000000403', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000999', current_date - 1, null),
      ('00000000-0000-4000-8000-000000000404', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000171', current_date - 1, null),
      ('00000000-0000-4000-8000-000000000405', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000305', '00000000-0000-4000-8000-000000000171', current_date - 1, null);
    insert into public.user_group_permissions
      (user_id, tenant_id, hr_group_id, permission_code, role_code) values
      ('00000000-0000-4000-8000-000000000071', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'absence:read', 'DIRECT_MANAGER'),
      ('00000000-0000-4000-8000-000000000071', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'employee:read', 'DIRECT_MANAGER'),
      ('00000000-0000-4000-8000-000000000071', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'report-leave:read', 'DIRECT_MANAGER');

    insert into public.absence_cases
      (id, tenant_id, hr_group_id, administration_id, employee_id) values
      ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000301'),
      ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000302'),
      ('00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000303'),
      ('00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000304'),
      ('00000000-0000-4000-8000-000000000505', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000305');
    insert into public.absence_spells (id, tenant_id, hr_group_id, case_id) values
      ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000501'),
      ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000502'),
      ('00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000503'),
      ('00000000-0000-4000-8000-000000000604', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000504'),
      ('00000000-0000-4000-8000-000000000605', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000505');
    insert into public.absence_capacity_changes (id, tenant_id, hr_group_id, case_id, spell_id) values
      ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000601'),
      ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000602'),
      ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000604'),
      ('00000000-0000-4000-8000-000000000704', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000505', '00000000-0000-4000-8000-000000000605');
  `)
  return db
}

async function setManager(db: PGlite): Promise<void> {
  await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', managerUser])
  await db.exec('set role authenticated')
}

afterEach(async () => {
  if (database) await database.close()
  database = null
})

describe('absence Insights direct-team boundary with operational RLS', () => {
  it('models permissive operational SELECT access, then narrows reports by active administration and the direct-team allowlist', async () => {
    const [absenceSql, selfSql, leaveSql, authorizationSql, teamScope, absenceReport, frequentReport] = await Promise.all([
      readFile(casesPolicyUrl, 'utf8'),
      readFile(selfPolicyUrl, 'utf8'),
      readFile(leavePolicyUrl, 'utf8'),
      readFile(authorizationHelperUrl, 'utf8'),
      readFile(teamScopeUrl, 'utf8'),
      readFile(absenceReportUrl, 'utf8'),
      readFile(frequentReportUrl, 'utf8'),
    ])
    expect(absenceSql).toContain("can_manage_employee(employee_id, 'absence:read')")
    expect(selfSql).toContain("self:absence:read")
    expect(leaveSql).toContain('create policy leave_insights_absence_cases_read')
    expect(leaveSql).toContain("'report-leave:read'")
    expect(authorizationSql).toContain('internal_security.current_user_has_hr_group_permission(')
    expect(authorizationSql).toContain('actor.id = placement.direct_manager_id')
    expect(teamScope).toContain(".eq('direct_manager_id', auth.employeeId)")
    expect(teamScope).toContain(".eq('administration_id', auth.administrationId)")
    expect(absenceReport).toContain('assertAbsenceInsightEmployeeAllowlist')
    expect(frequentReport).toContain('assertAbsenceInsightEmployeeAllowlist')

    database = await createDatabase()
    const db = database
    await setManager(db)

    const policies = await db.query<{ policyname: string; permissive: string }>(`
      select policyname, permissive from pg_policies
      where schemaname = 'public'
        and tablename in ('absence_cases', 'absence_spells', 'absence_capacity_changes')
      order by tablename, policyname
    `)
    expect(policies.rows.filter((row) => row.policyname.endsWith('hr_group_boundary')).every((row) => row.permissive === 'RESTRICTIVE')).toBe(true)
    expect(policies.rows.filter((row) => !row.policyname.endsWith('hr_group_boundary')).every((row) => row.permissive === 'PERMISSIVE')).toBe(true)

    const operationalCases = await db.query<{ employee_id: string; administration_id: string }>(`
      select employee_id, administration_id from public.absence_cases order by employee_id
    `)
    expect(operationalCases.rows).toEqual([
      { employee_id: directEmployee, administration_id: '00000000-0000-4000-8000-000000000021' },
      { employee_id: groupColleague, administration_id: '00000000-0000-4000-8000-000000000021' },
      { employee_id: otherAdministrationEmployee, administration_id: '00000000-0000-4000-8000-000000000022' },
    ])
    expect((await db.query('select id from public.absence_spells')).rows).toHaveLength(3)
    expect((await db.query('select id from public.absence_capacity_changes')).rows).toHaveLength(2)
    expect(operationalCases.rows.map((row) => row.employee_id)).not.toContain(otherGroupEmployee)
    expect(operationalCases.rows.map((row) => row.employee_id)).not.toContain(otherTenantEmployee)

    const reportRows = await db.query<{ employee_id: string; spell_count: number; capacity_count: number }>(`
      with direct_team as (
        select distinct employee_id
        from public.employee_organizations
        where tenant_id = $1 and hr_group_id = $2 and administration_id = $3
          and direct_manager_id = (select internal_security.current_employee_id())
          and effective_from <= current_date and (effective_to is null or effective_to >= current_date)
      )
      select absence_case.employee_id,
        count(distinct spell.id)::integer as spell_count,
        count(distinct capacity.id)::integer as capacity_count
      from public.absence_cases absence_case
      left join public.absence_spells spell
        on spell.case_id = absence_case.id and spell.tenant_id = absence_case.tenant_id
      left join public.absence_capacity_changes capacity
        on capacity.case_id = absence_case.id and capacity.tenant_id = absence_case.tenant_id
      where absence_case.tenant_id = $1
        and absence_case.hr_group_id = $2
        and absence_case.administration_id = $3
        and absence_case.employee_id in (select employee_id from direct_team)
      group by absence_case.employee_id
    `, [tenantA, groupA, '00000000-0000-4000-8000-000000000021'])
    expect(reportRows.rows).toEqual([{ employee_id: directEmployee, spell_count: 1, capacity_count: 1 }])
  })
})
