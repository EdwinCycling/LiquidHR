import { describe, expect, it } from 'vitest'
import { applyPayrollScopeFilter, payrollScopeFromAuthContext, PayrollScopeError } from './scope'

const scope = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  hrGroupId: '22222222-2222-4222-8222-222222222222',
  administrationId: '33333333-3333-4333-8333-333333333333',
}

class FilterRecorder {
  readonly filters: Array<[string, string]> = []

  eq(column: string, value: string): this {
    this.filters.push([column, value])
    return this
  }
}

describe('Payroll Lab scope', () => {
  it('requires tenant, HR group, and selected administration from the server context', () => {
    expect(payrollScopeFromAuthContext({ ...scope, hrGroupId: undefined })).toBeNull()
    expect(payrollScopeFromAuthContext({ ...scope, administrationId: null })).toBeNull()
    expect(payrollScopeFromAuthContext({ ...scope, tenantId: 'not-a-uuid' })).toBeNull()
    expect(payrollScopeFromAuthContext(scope)).toEqual(scope)
  })

  it('adds every independent scope key to a read or write query builder', () => {
    const builder = new FilterRecorder()
    applyPayrollScopeFilter(builder, scope)

    expect(builder.filters).toEqual([
      ['source_tenant_id', scope.tenantId],
      ['source_hr_group_id', scope.hrGroupId],
      ['source_administration_id', scope.administrationId],
    ])
  })

  it('rejects missing or malformed scope before query execution', () => {
    const builder = new FilterRecorder()
    expect(() => applyPayrollScopeFilter(builder, { ...scope, administrationId: '' })).toThrow(PayrollScopeError)
    expect(builder.filters).toEqual([])
  })
})
