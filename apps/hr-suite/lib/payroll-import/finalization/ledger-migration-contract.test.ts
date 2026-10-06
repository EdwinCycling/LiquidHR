import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migrationPath = fileURLToPath(new URL('../../../supabase/migrations/20261005100056_control02_payroll_finalization_ledger.sql', import.meta.url))

describe('CONTROL02 finalization ledger migration candidate', () => {
  it('persists immutable same-person dependencies and rejects claims until each dependency is complete', () => {
    const migration = readFileSync(migrationPath, 'utf8').toLowerCase()
    const actionTable = migration.match(/create table public\.payroll_import_finalization_actions\s*\(([\s\s\S]*?)\n\);/)?.[1] ?? ''
    const actionTrigger = migration.match(/create function internal_security\.validate_payroll_import_finalization_action_scope\(\)([\s\S]*?)\$\$;/)?.[1] ?? ''
    const eventRpc = migration.match(/create or replace function public\.record_payroll_import_finalization_event\(([\s\s\S]*?)\$\$;/)?.[1] ?? ''

    expect(actionTable).toContain("depends_on_action_ids text[] not null default '{}'")
    expect(actionTable).toContain('action_id = any(depends_on_action_ids)')
    expect(actionTrigger).toContain('cardinality(new.depends_on_action_ids)')
    expect(actionTrigger).toContain('old.depends_on_action_ids')
    expect(actionTrigger).toContain('new.depends_on_action_ids')
    expect(eventRpc).toContain('dependency.import_person_id = current_action.import_person_id')
    expect(eventRpc).toContain("dependency.status = 'completed'")
    expect(eventRpc).toContain('dependency.sequence_no < current_action.sequence_no')
  })

  it('fences worker transitions with an expiring lease owner and a one-way token hash', () => {
    const migration = readFileSync(migrationPath, 'utf8').toLowerCase()
    const actionTable = migration.match(/create table public\.payroll_import_finalization_actions\s*\(([\s\s\S]*?)\n\);/)?.[1] ?? ''
    const eventTable = migration.match(/create table public\.payroll_import_finalization_action_events\s*\(([\s\s\S]*?)\n\);/)?.[1] ?? ''
    const eventRpc = migration.match(/create or replace function public\.record_payroll_import_finalization_event\(([\s\s\S]*?)\n\$\$;/)?.[1] ?? ''

    expect(actionTable).toContain('lease_owner uuid')
    expect(actionTable).toContain('lease_token_hash text')
    expect(actionTable).toContain("lease_token_hash ~ '^[0-9a-f]{64}$'")
    expect(actionTable).toContain("status = 'in_progress'")
    expect(eventTable).toContain('lease_owner uuid')
    expect(eventRpc).toContain('requested_lease_token_hash')
    expect(eventRpc).toContain('requested_lease_owner is distinct from current_action.lease_owner')
    expect(eventRpc).toContain('requested_lease_token_hash is distinct from current_action.lease_token_hash')
    expect(eventRpc).toContain('current_action.lease_until <= timezone')
    expect(eventRpc).not.toContain('requested_lease_token text')
  })
})
