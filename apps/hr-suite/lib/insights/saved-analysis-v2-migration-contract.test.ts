import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationPath = new URL('../../supabase/migrations/20260902090000_enable_saved_analysis_v2.sql', import.meta.url)
const migration = readFileSync(migrationPath, 'utf8').replaceAll('\r\n', '\n')

describe('V2 saved-analysis forward migration candidate', () => {
  it('extends only the existing definition version and strict validator', () => {
    expect(migration).toContain('drop constraint if exists saved_analysis_definitions_version_check')
    expect(migration).toContain('check (definition_version in (1, 2))')
    expect(migration).toContain("candidate -> 'version' = '1'::jsonb")
    expect(migration).toContain("candidate -> 'version' <> '2'::jsonb")
    expect(migration).toContain("candidate -> 'period'")
    expect(migration).toContain("candidate -> 'comparison'")
    expect(migration).toContain("'employment_type'")
    expect(migration).toContain('TEMPORARY_AGENCY')
    expect(migration).toContain("candidate -> 'presentation' -> 'intent'")
    expect(migration).toContain(`count(distinct element.value ->> 'dimension')
    from jsonb_array_elements(candidate -> 'filters') as element(value)`)
    expect(migration).not.toContain(`count(distinct element.value #>> '{}')
    from jsonb_array_elements(candidate -> 'filters') as element(value)`)
    expect(migration).toContain('is_valid_saved_analysis_date')
    expect(migration).toContain('% 400')
    expect(migration).toContain('is_valid_saved_analysis_spec')
  })

  it('does not add a snapshot store, execution RPC, indexes or remote-apply command', () => {
    expect(migration).not.toMatch(/create table public\.(analysis_)?snapshots?/i)
    expect(migration).not.toMatch(/create function .*snapshot/i)
    expect(migration).not.toMatch(/create index/i)
    expect(migration).not.toMatch(/supabase db push|migration repair|include-all/i)
    expect(migration).toContain('commit;')
  })
})
