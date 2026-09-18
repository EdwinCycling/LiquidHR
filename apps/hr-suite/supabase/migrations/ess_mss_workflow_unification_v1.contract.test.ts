import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const enumMigration = readFileSync(new URL('./20260917141844_ess_mss_workflow_unification_leave_status.sql', import.meta.url), 'utf8').toLowerCase()
const migrationSource = readFileSync(new URL('./20260917141907_ess_mss_workflow_unification_v1.sql', import.meta.url), 'utf8')
const migration = migrationSource.toLowerCase()

describe('ESS/MSS Workflow Unification V1 migration contract', () => {
  it('adds Leave lifecycle values before the transactional migration', () => {
    expect(enumMigration).toContain("alter type public.leave_request_status add value if not exists 'pending'")
    expect(enumMigration).toContain("alter type public.leave_request_status add value if not exists 'changes_requested'")
    expect(enumMigration.trim()).not.toMatch(/^begin;/)
    expect(migration.trimStart()).toMatch(/^begin;/)
    expect(migration.trimEnd()).toMatch(/commit;$/)
  })

  it('makes the unified business boundary queryable without changing domain ownership', () => {
    for (const table of ['process_recipe_catalog', 'process_definitions', 'process_instances', 'process_work_items']) {
      expect(migration).toContain(`alter table public.${table}`)
      expect(migration).toContain(`${table}_business_type_check`)
      expect(migration).toContain(`${table}_business_category_check`)
    }
    expect(migration).toContain("'p_mutation', 'leave', 'actual_work', 'other'")
    expect(migration).toContain("'general', 'internal_transfer', 'document_acknowledgement', 'leave_request', 'actual_work_entry'")
    expect(migration).toContain("'adapterkey', 'leave_request_booking'")
    expect(migration).toContain("'ess_process_automation'")
    expect(migration).toContain("'ess_leave_workflow'")
  })

  it('seals the Leave adapter with scoped bridge, RLS and idempotency contracts', () => {
    expect(migration).toContain('create table if not exists public.process_leave_subjects')
    expect(migration).toContain('process_leave_subjects_request_fkey')
    expect(migration).toContain('constraint process_leave_subjects_request_unique unique')
    expect(migration).toContain('alter table public.process_leave_subjects enable row level security')
    expect(migration).toContain('create policy process_leave_subjects_no_direct_access')
    expect(migration).toContain('using (false) with check (false)')
    expect(migration).toContain('revoke all on table public.process_leave_subjects')
    expect(migration).toContain('leave_requests_workflow_idempotency_unique')
    expect(migration.indexOf('leave_requests_tenant_hr_group_admin_id_key')).toBeLessThan(migration.indexOf('create table if not exists public.process_leave_subjects'))
    expect(migration).toContain('process_domain_commits')
    expect(migration).toContain('perform_process_work_item_action')
    expect(migration).toContain('request_process_work_item_changes')
    expect(migration).toContain('process_form_actor_allowed')
  })

  it('adds covering indexes for the new composite foreign keys', () => {
    const advisorMigration = readFileSync(
      new URL('./20260917142539_ess_mss_workflow_unification_v1_advisor_indexes.sql', import.meta.url),
      'utf8',
    ).toLowerCase()

    expect(advisorMigration).toContain(
      'on public.process_leave_subjects (tenant_id, hr_group_id, process_instance_id)',
    )
    expect(advisorMigration).toContain(
      'on public.process_leave_subjects (tenant_id, hr_group_id, administration_id, leave_request_id)',
    )
    expect(advisorMigration).toContain(
      'on public.process_recipe_activations (process_recipe_id)',
    )
  })

  it('keeps activation scope explicit and exposes only authenticated RPC wrappers', () => {
    expect(migration).toContain('process_recipe_activation_scope_unique')
    expect(migration).toContain('requested_scope_type public.access_scope_type')
    expect(migration).toContain('requested_administration_id uuid')
    expect(migration).toContain('grant execute on function public.start_leave_request_workflow')
    expect(migration).toContain('grant execute on function public.perform_leave_workflow_action')
    expect(migration).toMatch(/revoke all on function internal_security\.perform_leave_workflow_action_internal[\s\S]*from public, anon, authenticated/)
    expect(migration).not.toMatch(/grant execute on function internal_security\.(start_leave_request_workflow_internal|perform_leave_workflow_action_internal)/)

    const wrapperExecutionMigration = readFileSync(
      new URL('./20260917154313_ess_mss_workflow_unification_v1_wrapper_execution.sql', import.meta.url),
      'utf8',
    ).toLowerCase()
    expect(wrapperExecutionMigration).toContain('grant execute on function internal_security.start_leave_request_workflow_internal')
    expect(wrapperExecutionMigration).toContain('grant execute on function internal_security.perform_leave_workflow_action_internal')
    expect(wrapperExecutionMigration).toContain('grant execute on function internal_security.get_unified_process_work_item_detail')
  })

  it('keeps the shared projection server-filtered for request view and business facets', () => {
    expect(migration).toContain("upper(coalesce(requested_view, 'work')) = 'requests'")
    expect(migration).toContain('classified.request_rank = 1')
    expect(migration).toContain('requested_business_type')
    expect(migration).toContain('requested_business_category')
    expect(migration).toContain('requested_subject_employment_id')
    expect(migration).toContain('internal_security.process_work_item_can_read')
  })

  it('keeps the seeded Leave recipe valid for the existing definition compiler', async () => {
    const recipeMatch = migrationSource.match(/\$recipe\$([\s\S]*?)\$recipe\$::jsonb/)
    expect(recipeMatch?.[1]).toBeDefined()
    const { compileProcessDefinition } = await import('@/lib/process-automation/definition-compiler')
    expect(() => compileProcessDefinition(JSON.parse(recipeMatch?.[1] ?? ''), { requiredLanguages: ['nl', 'en'] })).not.toThrow()
  })
})
