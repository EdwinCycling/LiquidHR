import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./20261024150000_employee_directory_scope_hardening.sql', import.meta.url), 'utf8')
const originalDirectoryDetail = readFileSync(new URL('./20260804144733_employee_directory_settings_v5.sql', import.meta.url), 'utf8')
const latestDirectoryDetail = readFileSync(new URL('./20260804145603_employee_directory_schedule_fallback.sql', import.meta.url), 'utf8')
const employeeOverview = readFileSync(new URL('./20261013143616_employee_overview_server_pagination.sql', import.meta.url), 'utf8')
const currentCoreOverviewScopePrefix = [
  '      and employee.deleted_at is null',
  '      and (',
  '        exists (',
  '          select 1',
  '          from public.employee_administration_assignments assignment',
].join('\n')
const overviewEmployeeAnchorText = '      and employee.deleted_at is null\n      and ('

describe('employee directory scope hardening migration', () => {
  it('limits safe detail projection to the requested active HR group and confirmed administration employment', () => {
    expect(migration).toContain('employee.hr_group_id = (')
    expect(migration).toContain('and administration.is_active')
    expect(migration).toContain("employee directory employment scope anchor is missing or ambiguous")
    expect(migration).toContain("if employment_row.id is null then")
    expect(migration).toContain("using errcode = 'P0002'")
  })

  it('returns a controlled not-found result before an unassigned schedule pattern record is dereferenced', () => {
    expect(originalDirectoryDetail).toMatch(/if employment_row\.id is not null then[\s\S]*?select pattern\.\*[\s\S]*?into pattern_row/)
    expect(latestDirectoryDetail).toMatch(/if employment_row\.id is not null then[\s\S]*?select pattern\.\*[\s\S]*?into pattern_row/)
    expect(originalDirectoryDetail).toContain('work_pattern_id = pattern_row.id')
    expect(migration).toContain("if employment_row.id is null then\n    raise exception 'employee not found' using errcode = 'P0002';\n  end if;")
  })

  it('matches the checked-in and observed Core TEST directory function anchor shapes', () => {
    const detailEmployeeAnchor = /where employee\.tenant_id = requested_tenant_id\s+and employee\.id = requested_employee_id\s+and employee\.deleted_at is null;/g
    const detailEmploymentAnchor = /order by employment\.is_primary desc, employment\.starts_on desc\s+limit 1;\s+select organization\.job_title, department\.name as department_name/g
    const overviewEmployeeAnchor = /and employee\.deleted_at is null\s+and \(/g
    const overviewPlacementAnchor = /and organization\.employee_id = employee\.id\s+and organization\.effective_from <= v_as_of/g

    expect([...latestDirectoryDetail.matchAll(detailEmployeeAnchor)]).toHaveLength(1)
    expect([...latestDirectoryDetail.matchAll(detailEmploymentAnchor)]).toHaveLength(1)
    expect([...employeeOverview.matchAll(overviewEmployeeAnchor)]).toHaveLength(1)
    expect(currentCoreOverviewScopePrefix.startsWith(overviewEmployeeAnchorText)).toBe(true)
    expect(migration).toContain(overviewEmployeeAnchorText)
    expect([...employeeOverview.matchAll(overviewPlacementAnchor)]).toHaveLength(1)
    expect(migration).toMatch(/detail_employee_anchor constant text := \$anchor\$[\s\S]*?where employee\.tenant_id = requested_tenant_id[\s\S]*?employee\.deleted_at is null;/)
    expect(migration).toMatch(/overview_employee_anchor constant text := \$anchor\$[\s\S]*?employee\.deleted_at is null\s+and \(/)
    expect(migration).toMatch(/overview_employee_replacement constant text := \$replacement\$[\s\S]*?not v_directory_only[\s\S]*?directory_employment\.record_status = 'CONFIRMED'/)
    expect(migration).toMatch(/overview_placement_anchor constant text := \$anchor\$[\s\S]*?organization\.employee_id = employee\.id[\s\S]*?organization\.effective_from <= v_as_of/)
  })

  it('limits employee-directory lists and organization labels to the selected administration', () => {
    expect(migration).toContain('directory_employment.administration_id = requested_administration_id')
    expect(migration).toContain("directory_employment.record_status = 'CONFIRMED'")
    expect(migration).toContain('directory_employment.starts_on <= v_as_of')
    expect(migration).toContain('not v_directory_only or organization.administration_id = requested_administration_id')
  })

  it('does not add role grants, table policies, or a global RLS bypass', () => {
    expect(migration).not.toMatch(/role_permissions|create policy|enable row level security|disable row level security|service_role/i)
  })
})
