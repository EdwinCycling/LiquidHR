import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./20261021143000_pmux03a_ess_process_start_catalog.sql', import.meta.url), 'utf8')

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

  it('returns human-readable version-pinned step and route labels without internal keys', () => {
    expect(migration).toContain("'title', step.value -> 'title'")
    expect(migration).toContain("'responsibleRole', participant.label")
    expect(migration).toContain("'fromTitle', from_step.value -> 'title'")
    expect(migration).toContain("'toTitle', to_step.value -> 'title'")
    expect(migration).not.toContain("'stepKey'")
    expect(migration).not.toContain("'participantKey',")
  })
})
