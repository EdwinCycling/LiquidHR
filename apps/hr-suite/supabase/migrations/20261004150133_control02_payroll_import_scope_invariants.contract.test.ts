import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migration = readFileSync(
  resolve(__dirname, '20261004150133_control02_payroll_import_scope_invariants.sql'),
  'utf8',
)

describe('CONTROL02 payroll import scope invariants', () => {
  it('adds the batch dimension to the income-person reference', () => {
    expect(migration).toContain('create unique index payroll_import_persons_tenant_hr_group_batch_id_key')
    expect(migration).toContain(
      'on public.payroll_import_persons (tenant_id, hr_group_id, batch_id, id)',
    )
    expect(migration).toContain('drop constraint payroll_import_income_person_scope_fkey')
    expect(migration).toContain(
      'foreign key (tenant_id, hr_group_id, batch_id, import_person_id)',
    )
    expect(migration).not.toContain(
      'foreign key (tenant_id, hr_group_id, import_person_id)',
    )
    expect(migration).toContain(
      'references public.payroll_import_persons (tenant_id, hr_group_id, batch_id, id)',
    )
    expect(migration).toContain('on delete cascade')
  })

  it('adds the HR-group dimension to employee matching', () => {
    expect(migration).toContain('drop constraint payroll_import_persons_employee_scope_fkey')
    expect(migration).toContain(
      'foreign key (tenant_id, hr_group_id, matched_employee_id)',
    )
    expect(migration).not.toContain(
      'foreign key (tenant_id, matched_employee_id)',
    )
    expect(migration).toContain(
      'references public.employees (tenant_id, hr_group_id, id)',
    )
    expect(migration).toContain('on delete restrict')
  })

  it('is a forward-only, approved-scope migration', () => {
    expect(migration).toContain('CONVERGENCE_REQUIRED')
    expect(migration).toContain('begin;')
    expect(migration).toContain('commit;')
    expect(migration).not.toMatch(/\b(drop|delete|truncate)\s+(table|schema|from)\b/i)
    expect(migration).not.toMatch(/\b(create|alter|drop)\s+(role|user|policy)\b/i)
    expect(migration).not.toContain('payroll_import_batches')
    expect(migration).not.toContain('administration_payroll_tax_numbers')
  })
})
