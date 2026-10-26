import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('./20261026190604_pmux_security_authorization_hardening.sql', import.meta.url),
  'utf8',
)

function extractFunctionDefinition(functionName: string): string {
  const start = migration.toLowerCase().indexOf(`create or replace function ${functionName.toLowerCase()}(`)
  if (start < 0) throw new Error(`Expected function not found: ${functionName}`)
  const endMarker = '\n$$;'
  const end = migration.indexOf(endMarker, start)
  if (end < 0) throw new Error(`Expected function terminator not found: ${functionName}`)
  return migration.slice(start, end + endMarker.length)
}

describe('PMUX authorization hardening', () => {
  it('separates current subject authorization from candidate routing snapshots', async () => {
    const db = new PGlite()
    const ids = {
      tenant: '00000000-0000-4000-8000-000000000010',
      group: '00000000-0000-4000-8000-000000000020',
      adminA: '00000000-0000-4000-8000-000000000030',
      adminB: '00000000-0000-4000-8000-000000000031',
      userManager: '00000000-0000-4000-8000-000000000001',
      employeeManager: '00000000-0000-4000-8000-000000000101',
      userDepartmentManager: '00000000-0000-4000-8000-000000000002',
      employeeDepartmentManager: '00000000-0000-4000-8000-000000000102',
      userOutsideManager: '00000000-0000-4000-8000-000000000003',
      employeeOutsideManager: '00000000-0000-4000-8000-000000000103',
      userEmployee: '00000000-0000-4000-8000-000000000004',
      employeeSubject: '00000000-0000-4000-8000-000000000104',
      userForeignEmployee: '00000000-0000-4000-8000-000000000005',
      employeeForeign: '00000000-0000-4000-8000-000000000105',
      userAdmin: '00000000-0000-4000-8000-000000000006',
      userViewer: '00000000-0000-4000-8000-000000000007',
      userScopedAdmin: '00000000-0000-4000-8000-000000000008',
      userWrongAdmin: '00000000-0000-4000-8000-000000000009',
      roleDirect: '00000000-0000-4000-8000-000000000201',
      roleDepartment: '00000000-0000-4000-8000-000000000202',
      roleEmployee: '00000000-0000-4000-8000-000000000203',
      roleAdmin: '00000000-0000-4000-8000-000000000204',
      roleViewer: '00000000-0000-4000-8000-000000000205',
      departmentRoot: '00000000-0000-4000-8000-000000000301',
      departmentSubject: '00000000-0000-4000-8000-000000000302',
      departmentOther: '00000000-0000-4000-8000-000000000303',
      instance: '00000000-0000-4000-8000-000000000401',
      workItem: '00000000-0000-4000-8000-000000000402',
    }

    try {
      await db.exec(`
        create role authenticated;
        create role anon;
        create schema auth;
        create schema internal_security;
        create type public.access_scope_type as enum ('TENANT', 'ADMINISTRATION');
        create function auth.uid() returns uuid language sql stable
          as $$ select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid $$;

        create table public.administrations (
          tenant_id uuid not null, hr_group_id uuid not null, id uuid not null, is_active boolean not null
        );
        create table public.management_roles (
          id uuid primary key, code text not null, tenant_id uuid, is_active boolean not null, deleted_at timestamptz
        );
        create table public.permissions (id uuid primary key, code text not null unique);
        create table public.role_permissions (management_role_id uuid not null, permission_id uuid not null);
        create table public.user_access (
          user_id uuid not null, tenant_id uuid not null, management_role_id uuid not null,
          scope_type public.access_scope_type not null, administration_id uuid, is_active boolean not null
        );
        create table public.employees (
          tenant_id uuid not null, hr_group_id uuid not null, id uuid not null, auth_user_id uuid,
          is_active boolean not null, deleted_at timestamptz, created_at timestamptz not null default now()
        );
        create table public.departments (
          tenant_id uuid not null, hr_group_id uuid not null, id uuid not null, parent_id uuid, is_active boolean not null
        );
        create table public.employee_organizations (
          tenant_id uuid not null, hr_group_id uuid not null, administration_id uuid not null,
          employee_id uuid not null, department_id uuid not null, direct_manager_id uuid,
          effective_from date not null, effective_to date
        );
        create table public.department_management (
          tenant_id uuid not null, hr_group_id uuid not null, employee_id uuid not null,
          department_id uuid, management_role_id uuid not null, effective_from date not null, effective_to date
        );
        create table public.process_instances (
          id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
          scope_type public.access_scope_type not null, administration_id uuid,
          initiator_employee_id uuid
        );
        create table public.process_employee_subjects (
          process_instance_id uuid not null, tenant_id uuid not null, hr_group_id uuid not null, employee_id uuid not null
        );
        create table public.employments (
          tenant_id uuid not null, hr_group_id uuid not null, administration_id uuid not null,
          id uuid not null, employee_id uuid not null
        );
        create table public.process_employment_subjects (
          process_instance_id uuid not null, tenant_id uuid not null, hr_group_id uuid not null,
          administration_id uuid not null, employment_id uuid not null
        );
        create table public.process_work_items (
          id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null, process_instance_id uuid not null
        );
        create table public.process_work_item_candidates (
          tenant_id uuid not null, hr_group_id uuid not null, work_item_id uuid not null,
          employee_id uuid not null, candidate_user_id uuid, is_eligible boolean not null,
          resolution_revision integer not null
        );

        insert into public.administrations values
          ('${ids.tenant}', '${ids.group}', '${ids.adminA}', true),
          ('${ids.tenant}', '${ids.group}', '${ids.adminB}', true);
        insert into public.management_roles values
          ('${ids.roleDirect}', 'DIRECT_MANAGER', null, true, null),
          ('${ids.roleDepartment}', 'DEPARTMENT_MANAGER', null, true, null),
          ('${ids.roleEmployee}', 'EMPLOYEE', null, true, null),
          ('${ids.roleAdmin}', 'TENANT_ADMIN', null, true, null),
          ('${ids.roleViewer}', 'PROCESS_VIEWER', null, true, null);
        insert into public.permissions (id, code) values
          ('00000000-0000-4000-8000-000000000501', 'process-instance:read'),
          ('00000000-0000-4000-8000-000000000502', 'process-task:read'),
          ('00000000-0000-4000-8000-000000000503', 'process-task:act'),
          ('00000000-0000-4000-8000-000000000504', 'process-task:reassign'),
          ('00000000-0000-4000-8000-000000000505', 'self:process-instance:read'),
          ('00000000-0000-4000-8000-000000000506', 'self:process-task:read'),
          ('00000000-0000-4000-8000-000000000507', 'self:process-task:act');
        insert into public.role_permissions
        select role_id::uuid, permission.id
        from (values
          ('${ids.roleDirect}', 'process-instance:read'), ('${ids.roleDirect}', 'process-task:read'),
          ('${ids.roleDirect}', 'process-task:act'), ('${ids.roleDirect}', 'process-task:reassign'),
          ('${ids.roleDepartment}', 'process-instance:read'), ('${ids.roleDepartment}', 'process-task:read'),
          ('${ids.roleDepartment}', 'process-task:act'), ('${ids.roleDepartment}', 'process-task:reassign'),
          ('${ids.roleEmployee}', 'self:process-instance:read'), ('${ids.roleEmployee}', 'self:process-task:read'),
          ('${ids.roleEmployee}', 'self:process-task:act'),
          ('${ids.roleAdmin}', 'process-instance:read'), ('${ids.roleAdmin}', 'process-task:read'),
          ('${ids.roleAdmin}', 'process-task:act'), ('${ids.roleAdmin}', 'process-task:reassign'),
          ('${ids.roleViewer}', 'process-task:read')
        ) grant_row(role_id, permission_code)
        join public.permissions permission on permission.code = grant_row.permission_code;
        insert into public.user_access values
          ('${ids.userEmployee}', '${ids.tenant}', '${ids.roleEmployee}', 'ADMINISTRATION', '${ids.adminA}', true),
          ('${ids.userForeignEmployee}', '${ids.tenant}', '${ids.roleEmployee}', 'ADMINISTRATION', '${ids.adminA}', true),
          ('${ids.userAdmin}', '${ids.tenant}', '${ids.roleAdmin}', 'TENANT', null, true),
        ('${ids.userViewer}', '${ids.tenant}', '${ids.roleViewer}', 'ADMINISTRATION', '${ids.adminA}', true),
        ('${ids.userScopedAdmin}', '${ids.tenant}', '${ids.roleAdmin}', 'ADMINISTRATION', '${ids.adminA}', true),
        ('${ids.userWrongAdmin}', '${ids.tenant}', '${ids.roleAdmin}', 'ADMINISTRATION', '${ids.adminB}', true);
        insert into public.employees (tenant_id, hr_group_id, id, auth_user_id, is_active, deleted_at) values
          ('${ids.tenant}', '${ids.group}', '${ids.employeeManager}', '${ids.userManager}', true, null),
          ('${ids.tenant}', '${ids.group}', '${ids.employeeDepartmentManager}', '${ids.userDepartmentManager}', true, null),
          ('${ids.tenant}', '${ids.group}', '${ids.employeeOutsideManager}', '${ids.userOutsideManager}', true, null),
          ('${ids.tenant}', '${ids.group}', '${ids.employeeSubject}', '${ids.userEmployee}', true, null),
          ('${ids.tenant}', '${ids.group}', '${ids.employeeForeign}', '${ids.userForeignEmployee}', true, null);
        insert into public.departments values
          ('${ids.tenant}', '${ids.group}', '${ids.departmentRoot}', null, true),
          ('${ids.tenant}', '${ids.group}', '${ids.departmentSubject}', '${ids.departmentRoot}', true),
          ('${ids.tenant}', '${ids.group}', '${ids.departmentOther}', null, true);
        insert into public.employee_organizations values
          ('${ids.tenant}', '${ids.group}', '${ids.adminA}', '${ids.employeeSubject}', '${ids.departmentSubject}', '${ids.employeeManager}', current_date - 10, null),
          ('${ids.tenant}', '${ids.group}', '${ids.adminB}', '${ids.employeeSubject}', '${ids.departmentOther}', '${ids.employeeOutsideManager}', current_date - 10, null);
        insert into public.department_management values
          ('${ids.tenant}', '${ids.group}', '${ids.employeeDepartmentManager}', '${ids.departmentRoot}', '${ids.roleDepartment}', current_date - 10, null);
        insert into public.process_instances values
          ('${ids.instance}', '${ids.tenant}', '${ids.group}', 'ADMINISTRATION', '${ids.adminA}', null);
        insert into public.process_employee_subjects values
          ('${ids.instance}', '${ids.tenant}', '${ids.group}', '${ids.employeeSubject}');
        insert into public.process_work_items values
          ('${ids.workItem}', '${ids.tenant}', '${ids.group}', '${ids.instance}');
        insert into public.process_work_item_candidates values
          ('${ids.tenant}', '${ids.group}', '${ids.workItem}', '${ids.employeeManager}', '${ids.userManager}', true, 1),
          ('${ids.tenant}', '${ids.group}', '${ids.workItem}', '${ids.employeeDepartmentManager}', '${ids.userDepartmentManager}', true, 1),
          ('${ids.tenant}', '${ids.group}', '${ids.workItem}', '${ids.employeeOutsideManager}', '${ids.userOutsideManager}', true, 1),
          ('${ids.tenant}', '${ids.group}', '${ids.workItem}', '${ids.employeeSubject}', '${ids.userEmployee}', true, 1);
      `)

      const functionNames = [
        'internal_security.process_user_has_scoped_permission',
        'internal_security.process_manager_has_subject_permission',
        'internal_security.process_subject_actor_has_permission',
        'internal_security.process_instance_user_has_permission',
        'internal_security.process_work_item_user_has_permission',
        'internal_security.process_work_item_user_is_latest_candidate',
        'internal_security.process_instance_can_read',
        'internal_security.process_work_item_can_read',
        'internal_security.process_form_actor_allowed',
      ]
      for (const functionName of functionNames) await db.exec(extractFunctionDefinition(functionName))
      await db.exec(`
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
        grant execute on function internal_security.process_instance_can_read(uuid, uuid, uuid) to authenticated;
        grant execute on function internal_security.process_work_item_can_read(uuid, uuid, uuid) to authenticated;
        select pg_catalog.set_config('request.jwt.claim.sub', '${ids.userManager}', false);
      `)

      const directManager = await db.query<{ can_read: boolean; can_act: boolean; latest_candidate: boolean }>(`
        select internal_security.process_instance_can_read('${ids.tenant}', '${ids.group}', '${ids.instance}') as can_read,
          internal_security.process_work_item_user_has_permission('${ids.workItem}', '${ids.userManager}', '${ids.employeeManager}', 'process-task:act') as can_act,
          internal_security.process_work_item_user_is_latest_candidate('${ids.workItem}', '${ids.userManager}', '${ids.employeeManager}') as latest_candidate
      `)
      expect(directManager.rows[0]).toEqual({ can_read: true, can_act: true, latest_candidate: true })

      await db.exec(`select pg_catalog.set_config('request.jwt.claim.sub', '${ids.userDepartmentManager}', false);`)
      const departmentManager = await db.query<{ can_read: boolean; can_act: boolean }>(`
        select internal_security.process_work_item_can_read('${ids.tenant}', '${ids.group}', '${ids.workItem}') as can_read,
          internal_security.process_form_actor_allowed('${ids.tenant}', '${ids.group}', '${ids.instance}', '${ids.workItem}', '${ids.userDepartmentManager}', '${ids.employeeDepartmentManager}') as can_act
      `)
      expect(departmentManager.rows[0]).toEqual({ can_read: true, can_act: true })

      await db.exec(`select pg_catalog.set_config('request.jwt.claim.sub', '${ids.userOutsideManager}', false);`)
      const outsideCandidate = await db.query<{ is_candidate: boolean; can_read: boolean; can_act: boolean }>(`
        select internal_security.process_work_item_user_is_latest_candidate('${ids.workItem}', '${ids.userOutsideManager}', '${ids.employeeOutsideManager}') as is_candidate,
          internal_security.process_work_item_can_read('${ids.tenant}', '${ids.group}', '${ids.workItem}') as can_read,
          internal_security.process_form_actor_allowed('${ids.tenant}', '${ids.group}', '${ids.instance}', '${ids.workItem}', '${ids.userOutsideManager}', '${ids.employeeOutsideManager}') as can_act
      `)
      expect(outsideCandidate.rows[0]).toEqual({ is_candidate: true, can_read: false, can_act: false })
      await db.exec(`insert into public.process_work_item_candidates values
        ('${ids.tenant}', '${ids.group}', '${ids.workItem}', '${ids.employeeOutsideManager}', '${ids.userOutsideManager}', false, 2);`)
      const staleCandidate = await db.query<{ is_latest_candidate: boolean }>(`
        select internal_security.process_work_item_user_is_latest_candidate('${ids.workItem}', '${ids.userOutsideManager}', '${ids.employeeOutsideManager}') as is_latest_candidate
      `)
      expect(staleCandidate.rows[0]).toEqual({ is_latest_candidate: false })

      await db.exec(`select pg_catalog.set_config('request.jwt.claim.sub', '${ids.userEmployee}', false);`)
      const ownEmployee = await db.query<{ can_read: boolean; can_act: boolean }>(`
        select internal_security.process_work_item_can_read('${ids.tenant}', '${ids.group}', '${ids.workItem}') as can_read,
          internal_security.process_form_actor_allowed('${ids.tenant}', '${ids.group}', '${ids.instance}', '${ids.workItem}', '${ids.userEmployee}', '${ids.employeeSubject}') as can_act
      `)
      expect(ownEmployee.rows[0]).toEqual({ can_read: true, can_act: true })

      const foreignEmployee = await db.query<{ can_act: boolean }>(`
        select internal_security.process_work_item_user_has_permission('${ids.workItem}', '${ids.userForeignEmployee}', '${ids.employeeForeign}', 'process-task:act') as can_act
      `)
      expect(foreignEmployee.rows[0]).toEqual({ can_act: false })

      await db.exec(`select pg_catalog.set_config('request.jwt.claim.sub', '${ids.userAdmin}', false);`)
      const hrAdminWithoutEmployeeLink = await db.query<{ can_read: boolean; can_act: boolean; can_claim: boolean }>(`
        select internal_security.process_work_item_can_read('${ids.tenant}', '${ids.group}', '${ids.workItem}') as can_read,
          internal_security.process_instance_user_has_permission('${ids.instance}', '${ids.userAdmin}', 'process-task:act', current_date) as can_act,
          internal_security.process_work_item_user_is_latest_candidate('${ids.workItem}', '${ids.userAdmin}', null) as can_claim
      `)
      expect(hrAdminWithoutEmployeeLink.rows[0]).toEqual({ can_read: true, can_act: true, can_claim: false })

      await db.exec(`select pg_catalog.set_config('request.jwt.claim.sub', '${ids.userScopedAdmin}', false);`)
      const hrAdminWithAdministrationGrant = await db.query<{ can_read: boolean; can_act: boolean; can_claim: boolean }>(`
        select internal_security.process_work_item_can_read('${ids.tenant}', '${ids.group}', '${ids.workItem}') as can_read,
          internal_security.process_work_item_user_has_permission('${ids.workItem}', '${ids.userScopedAdmin}', null, 'process-task:act') as can_act,
          internal_security.process_work_item_user_is_latest_candidate('${ids.workItem}', '${ids.userScopedAdmin}', null) as can_claim
      `)
      expect(hrAdminWithAdministrationGrant.rows[0]).toEqual({ can_read: true, can_act: true, can_claim: false })

      await db.exec(`select pg_catalog.set_config('request.jwt.claim.sub', '${ids.userWrongAdmin}', false);`)
      const hrAdminWithoutAdministrationGrant = await db.query<{ can_read: boolean; can_act: boolean }>(`
        select internal_security.process_work_item_can_read('${ids.tenant}', '${ids.group}', '${ids.workItem}') as can_read,
          internal_security.process_work_item_user_has_permission('${ids.workItem}', '${ids.userWrongAdmin}', null, 'process-task:act') as can_act
      `)
      expect(hrAdminWithoutAdministrationGrant.rows[0]).toEqual({ can_read: false, can_act: false })

      const unscopedViewer = await db.query<{ can_read: boolean }>(`
        select internal_security.process_instance_user_has_permission('${ids.instance}', '${ids.userViewer}', 'process-task:read', current_date) as can_read
      `)
      expect(unscopedViewer.rows[0]).toEqual({ can_read: false })

      const privateHelperAccess = await db.query<{ authenticated_can_execute: boolean }>(`
        select has_function_privilege(
          'authenticated',
          'internal_security.process_subject_actor_has_permission(uuid,uuid,public.access_scope_type,uuid,uuid,uuid,uuid,text,date)',
          'EXECUTE'
        ) as authenticated_can_execute
      `)
      expect(privateHelperAccess.rows[0]).toEqual({ authenticated_can_execute: false })
    } finally {
      await db.close()
    }
  })

  it('guards every PMUX execution path before domain writes and never promotes candidate state to authority', () => {
    const lower = migration.toLowerCase()
    expect(lower).toContain("'team_scope_required'")
    expect(lower).toContain('candidate.resolution_revision =')
    expect(lower).not.toContain('process_scope_has_permission(')

    const resolverStart = lower.indexOf('create or replace function internal_security.resolve_process_assignment(')
    const resolverEnd = lower.indexOf('\n$$;', resolverStart)
    const resolver = lower.slice(resolverStart, resolverEnd)
    const scopeFilterStart = resolver.indexOf('if requested_subject_employee_id is not null')
    const scopeFilterEnd = resolver.indexOf("if mode_name = 'exactly_one'", scopeFilterStart)
    const scopeFilter = resolver.slice(scopeFilterStart, scopeFilterEnd)
    expect(scopeFilter).toContain("like 'process-task:%'")
    expect(scopeFilter).toContain('process_subject_actor_has_permission(')
    expect(scopeFilter).not.toContain("selector ->> 'type' in")

    const performStart = lower.indexOf('create or replace function internal_security.perform_process_work_item_action(')
    const performEnd = lower.indexOf('\n$$;', performStart)
    const perform = lower.slice(performStart, performEnd)
    expect(perform.indexOf("'process-task:act'")).toBeLessThan(perform.indexOf('if existing_event_id is not null'))
    expect(perform).toContain('process_instance_user_has_permission(')
    expect(perform).not.toContain('candidate_ok')

    const claimStart = lower.indexOf('create or replace function internal_security.claim_process_work_item(')
    const claimEnd = lower.indexOf('\n$$;', claimStart)
    const claim = lower.slice(claimStart, claimEnd)
    expect(claim).toContain('for update of instance')
    expect(claim).toContain('for update;')
    expect(claim.indexOf("'process-task:act'")).toBeLessThan(claim.indexOf('update public.process_work_items'))
    expect(claim.indexOf('process_work_item_user_is_latest_candidate(')).toBeLessThan(claim.indexOf('update public.process_work_items'))
    expect(claim).toContain('append_process_event(')

    const projectionStart = lower.indexOf('create or replace function internal_security.get_process_work_projection(')
    const projectionEnd = lower.indexOf('\n$$;', projectionStart)
    const projection = lower.slice(projectionStart, projectionEnd)
    expect(projection).toContain('process_work_item_user_has_permission(')
    expect(projection).toContain("and base.candidate_ok) as can_claim")
    expect(projection).not.toContain('base.scope_can_act or base.candidate_ok')

    const itemReadStart = lower.indexOf('create or replace function internal_security.process_work_item_can_read(')
    const itemReadEnd = lower.indexOf('\n$$;', itemReadStart)
    expect(lower.slice(itemReadStart, itemReadEnd)).not.toContain('candidate')

    const p9Start = lower.indexOf('create or replace function internal_security.commit_internal_transfer(')
    const p9End = lower.indexOf('\n$$;', p9Start)
    const p9 = lower.slice(p9Start, p9End)
    expect(p9.indexOf("'process-task:act'")).toBeLessThan(p9.indexOf('if existing_commit.id is not null'))
    expect(p9.indexOf("'organization-placement:write'")).toBeLessThan(p9.indexOf('placement_id := public.manage_employment_organization_timeline'))

    const requestChangesAdapter = readFileSync(new URL('./20260809174153_process_automation_p9_commit_adapter.sql', import.meta.url), 'utf8').toLowerCase()
    const requestChangesStart = requestChangesAdapter.indexOf('create or replace function internal_security.request_process_work_item_changes(')
    const requestChangesEnd = requestChangesAdapter.indexOf('\n$$;', requestChangesStart)
    const requestChanges = requestChangesAdapter.slice(requestChangesStart, requestChangesEnd)
    expect(requestChanges.indexOf('perform_process_work_item_action(')).toBeLessThan(requestChanges.indexOf('insert into public.process_work_item_notes'))

    const leaveAdapter = readFileSync(new URL('./20260917141907_ess_mss_workflow_unification_v1.sql', import.meta.url), 'utf8').toLowerCase()
    const leaveStart = leaveAdapter.indexOf('create or replace function internal_security.perform_leave_workflow_action_internal(')
    const leaveEnd = leaveAdapter.indexOf('\n$$;', leaveStart)
    const leaveAction = leaveAdapter.slice(leaveStart, leaveEnd)
    expect(leaveAction.indexOf('process_form_actor_allowed(')).toBeLessThan(leaveAction.indexOf('update public.leave_requests'))
    expect(leaveAction.indexOf('process_form_actor_allowed(')).toBeLessThan(leaveAction.indexOf('book_leave_request_workflow('))

    const focusAdapter = readFileSync(new URL('./20260922230000_allow_focus_act_as_leave_workflow.sql', import.meta.url), 'utf8').toLowerCase()
    const focusStart = focusAdapter.indexOf('create or replace function internal_security.start_leave_request_workflow_internal(')
    const focusEnd = focusAdapter.indexOf('\n$$;', focusStart)
    const focusLeave = focusAdapter.slice(focusStart, focusEnd)
    expect(focusLeave.indexOf("'leave:request'")).toBeLessThan(focusLeave.indexOf('insert into public.leave_requests'))
    expect(focusLeave.indexOf('current_user_has_hr_group_permission(')).toBeLessThan(focusLeave.indexOf('insert into public.leave_requests'))

    const ackStart = lower.indexOf('create or replace function internal_security.acknowledge_document_process_work_item_internal(')
    const ackEnd = lower.indexOf('\n$$;', ackStart)
    const acknowledge = lower.slice(ackStart, ackEnd)
    expect(acknowledge.indexOf("'self:process-task:act'")).toBeLessThan(acknowledge.indexOf('if domain_commit_row.id is not null then return'))

    const documentStart = lower.indexOf('create or replace function internal_security.get_document_acknowledgement_document_internal(')
    const documentEnd = lower.indexOf('\n$$;', documentStart)
    expect(lower.slice(documentStart, documentEnd)).toContain("'self:process-task:read'")

    const wvpStart = lower.indexOf('create or replace function internal_security.wvp_case_access(')
    const wvpEnd = lower.indexOf('\n$$;', wvpStart)
    const wvp = lower.slice(wvpStart, wvpEnd)
    expect(wvp).toContain('process_manager_has_subject_permission(')
    expect(wvp).toContain('process_user_has_scoped_permission(')
  })
})
