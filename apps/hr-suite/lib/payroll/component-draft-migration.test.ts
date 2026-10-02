import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const payrollSource = fileURLToPath(new URL('../../../../apps/hr-suite', import.meta.url))
const migrationFile = join(payrollSource, 'lib', 'payroll', 'supabase', 'migrations', '20261001153005_paylab04_customer_component_versions.sql')

describe('PAYLAB04 customer component version migration contract', () => {
  it('keeps the DRAFT table in the Payroll Lab migration stream with same-database scoped ownership', () => {
    const migration = readFileSync(migrationFile, 'utf8').toLowerCase()

    expect(migration).toContain('create table public.customer_component_versions')
    expect(migration).toContain('foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)')
    expect(migration).toContain('references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id)')
    expect(migration).toContain("status text not null default 'draft' check (status = 'draft')")
    expect(migration).toContain('unique (source_tenant_id, source_hr_group_id, source_administration_id, component_code, component_version)')
    expect(migration).not.toMatch(/references\s+public\.(employees|employments|income_relationships|hr_groups|tenants|administrations)\b/)
  })

  it('binds JSON definition identity, effective dates, ownership and provenance to row columns', () => {
    const migration = readFileSync(migrationFile, 'utf8').toLowerCase()
    const definitionConstraint = migration.match(/constraint customer_component_versions_definition_matches_identity\s+check\s*\(([\s\S]*?)\),\s*constraint customer_component_versions_provenance_matches_ownership/)?.[1] ?? ''
    const provenanceConstraint = migration.match(/constraint customer_component_versions_provenance_matches_ownership\s+check\s*\(([\s\S]*?)\),\s*constraint customer_component_versions_origin_package_hash/)?.[1] ?? ''

    expect(definitionConstraint).toContain("definition_json ? 'effectiveto'")
    expect(definitionConstraint).toContain("(definition_json ->> 'effectiveto') is not distinct from")
    expect(definitionConstraint).toContain("(definition_json #>> '{ownership,kind}') is not distinct from ownership")
    expect(definitionConstraint).toContain("(definition_json #>> '{method,kind}' in ('source', 'passthrough', 'expression', 'aggregate')) is true")
    expect(provenanceConstraint).toContain("(definition_json #>> '{ownership,origin,id}') is not distinct from origin_component_id")
    expect(provenanceConstraint).toContain("(definition_json #>> '{ownership,origin,code}') is not distinct from origin_component_code")
    expect(provenanceConstraint).toContain("(catalog_metadata_json #>> '{package,packagehash}') is not distinct from origin_package_hash")
    expect(provenanceConstraint).toContain("not ((definition_json -> 'ownership') ? 'origin')")
    expect(provenanceConstraint).toContain("not ((definition_json -> 'ownership') ? 'forkedat')")
  })

  it('blocks executable RegisteredRules and grants only service-role SELECT/INSERT', () => {
    const migration = readFileSync(migrationFile, 'utf8').toLowerCase().replace(/\s+/g, ' ')

    expect(migration).toContain('alter table public.customer_component_versions enable row level security')
    expect(migration).toContain('create policy customer_component_versions_service_select on public.customer_component_versions for select to service_role')
    expect(migration).toContain('create policy customer_component_versions_service_insert on public.customer_component_versions for insert to service_role')
    expect(migration).toContain('revoke all on table public.customer_component_versions from public, anon, authenticated, service_role')
    expect(migration).toContain('grant select, insert on table public.customer_component_versions to service_role')
    expect(migration).not.toMatch(/grant\s+[^;]*\b(update|delete|all)\b[^;]*customer_component_versions/)
    expect(migration).not.toContain("'registeredrule'")
  })
})
