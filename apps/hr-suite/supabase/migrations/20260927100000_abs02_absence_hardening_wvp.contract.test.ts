import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const hardeningMigration = readFileSync(resolve(__dirname, '20260927100000_abs02_absence_hardening_wvp.sql'), 'utf8')
const selfScopeMigration = readFileSync(resolve(__dirname, '20260927101500_abs02_absence_lifecycle_self_scope.sql'), 'utf8')
const advisorFollowupMigration = readFileSync(resolve(__dirname, '20260927103000_abs02_advisor_followup.sql'), 'utf8')
const subjectFkIndexMigration = readFileSync(resolve(__dirname, '20260927104500_abs02_subject_fk_index.sql'), 'utf8')
const selfScopePermissionFixMigration = readFileSync(resolve(__dirname, '20260927110000_abs02_self_scope_permission_fix.sql'), 'utf8')

describe('ABS02 absence hardening and WvP migration contract', () => {
  it('removes direct core-table mutations while keeping canonical RPC execution available', () => {
    expect(hardeningMigration).toContain('revoke insert, update, delete on table public.absence_cases, public.absence_spells, public.absence_capacity_changes from public, anon, authenticated;')
    expect(hardeningMigration).toContain('drop policy if exists absence_cases_insert on public.absence_cases;')
    expect(hardeningMigration).toContain('grant execute on function public.generate_absence_wvp_tasks(uuid) to authenticated;')
    expect(hardeningMigration).toContain('grant execute on function public.complete_absence_wvp_task(uuid, text) to authenticated;')
  })

  it('defines RLS-only read access for human-confirmed, idempotent WvP task generation', () => {
    expect(hardeningMigration).toContain('create table public.absence_tasks')
    expect(hardeningMigration).toContain('alter table public.absence_tasks enable row level security;')
    expect(hardeningMigration).toContain('create policy absence_tasks_select')
    expect(hardeningMigration).toContain('revoke insert, update, delete on table public.absence_tasks from public, anon, authenticated;')
    expect(hardeningMigration).toContain('human_confirmation_required boolean not null default true')
    expect(hardeningMigration).toContain("source_version text not null default 'WVP_FOUNDATION_V1'")
    expect(hardeningMigration).toContain('on conflict (tenant_id, hr_group_id, case_id, milestone_code) do nothing;')
    expect(hardeningMigration).toContain("('WVP_WEEK_6', 'STATUTORY_CANDIDATE', 42)")
    expect(hardeningMigration).toContain("('WVP_WEEK_8', 'STATUTORY_CANDIDATE', 56)")
    expect(hardeningMigration).toContain("('WVP_WEEK_42', 'STATUTORY_CANDIDATE', 294)")
  })

  it('binds ACT-AS to an RLS-protected, revocable session row', () => {
    expect(hardeningMigration).toContain('create table public.focus_act_as_sessions')
    expect(hardeningMigration).toContain('alter table public.focus_act_as_sessions enable row level security;')
    expect(hardeningMigration).toContain('create policy focus_act_as_sessions_insert')
    expect(hardeningMigration).toContain('create policy focus_act_as_sessions_stop')
    expect(hardeningMigration).toContain('grant select, insert, update on table public.focus_act_as_sessions to authenticated;')
    expect(hardeningMigration).toContain('revoke delete on table public.focus_act_as_sessions from public, anon, authenticated;')
    expect(hardeningMigration).toContain('ended_at is null')
  })

  it('keeps self-service lifecycle normalization inside the same authorization boundary', () => {
    expect(selfScopeMigration).toContain("internal_security.current_employee_has_permission('self:absence:read')")
    expect(selfScopeMigration).toContain('absence_case.employee_id = internal_security.current_employee_id()')
    expect(selfScopeMigration).toContain("revoke all on function internal_security.normalize_expired_absence_cases(uuid, uuid) from public, anon, authenticated;")
    expect(selfScopePermissionFixMigration).toContain("internal_security.current_employee_has_permission('self:absence:read')")
  })

  it('keeps new foreign keys indexed and ACT-AS RLS init-plan safe', () => {
    expect(advisorFollowupMigration).toContain('absence_tasks_completed_by_user_idx')
    expect(advisorFollowupMigration).toContain('focus_act_as_sessions_actor_user_idx')
    expect(advisorFollowupMigration).toContain('focus_act_as_sessions_subject_employee_idx')
    expect(advisorFollowupMigration).toContain('actor_user_id = (select auth.uid())')
    expect(advisorFollowupMigration).not.toContain('actor_user_id = auth.uid()')
    expect(subjectFkIndexMigration).toContain('focus_act_as_sessions_subject_scope_idx')
    expect(subjectFkIndexMigration).toContain('(tenant_id, hr_group_id, subject_employee_id)')
  })
})
