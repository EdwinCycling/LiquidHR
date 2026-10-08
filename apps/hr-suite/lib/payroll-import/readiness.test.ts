import { describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import {
  checkHistoricalLhNr,
  evaluatePayrollImportReadiness,
  getPayrollImportReadiness,
  type PayrollImportReadinessDependencies,
  type PayrollTaxNumberBinding,
} from './readiness'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/permissions', () => ({
  AuthorizationError: class AuthorizationError extends Error {
    readonly status = 403
  },
  getRequestAuthorizationContext: vi.fn(),
}))

const currentLhNr: PayrollTaxNumberBinding = {
  payrollTaxNumber: '123456789L01',
  isPrimary: true,
  validFrom: '2026-01-01',
  validUntil: null,
}

const historicalLhNr: PayrollTaxNumberBinding = {
  payrollTaxNumber: '123456789L01',
  isPrimary: true,
  validFrom: '2024-01-01',
  validUntil: '2024-12-31',
}

function readyInput(overrides: Partial<Parameters<typeof evaluatePayrollImportReadiness>[0]> = {}) {
  return {
    tenantId: 'tenant-1',
    hrGroupId: 'group-1',
    administrationId: 'admin-1',
    hasActiveHrGroup: true,
    hasActiveAdministration: true,
    hasImportPermission: true,
    asOf: '2026-10-03',
    bindings: [currentLhNr],
    ...overrides,
  }
}

function source(overrides: Partial<NonNullable<Parameters<typeof evaluatePayrollImportReadiness>[0]['source']>> = {}) {
  return {
    sourceType: 'LOONAANGIFTE_XML' as const,
    supported: true,
    namespace: 'urn:belastingdienst:loonaangifte:2024',
    taxYear: 2024,
    payrollTaxNumber: historicalLhNr.payrollTaxNumber,
    periodStart: '2024-01-01',
    periodEnd: '2024-12-31',
    ...overrides,
  }
}

describe('CONTROL02 readiness contract', () => {
  it('valideert een volledig LhNr tegen het geïmporteerde historische tijdvak', () => {
    expect(checkHistoricalLhNr({
      payrollTaxNumber: historicalLhNr.payrollTaxNumber,
      periodStart: '2024-03-01',
      periodEnd: '2024-03-31',
      taxYear: 2024,
      bindings: [historicalLhNr],
    })).toMatchObject({ status: 'READY' })
  })

  it('gebruikt voor historische controle niet de actuele datum', () => {
    expect(checkHistoricalLhNr({
      payrollTaxNumber: historicalLhNr.payrollTaxNumber,
      periodStart: '2024-12-01',
      periodEnd: '2024-12-31',
      taxYear: 2024,
      bindings: [historicalLhNr],
    })).toMatchObject({ status: 'READY' })
  })

  it('blokkeert overlappende primaire LhNr-bindings, ook als één nummer overeenkomt', () => {
    expect(checkHistoricalLhNr({
      payrollTaxNumber: historicalLhNr.payrollTaxNumber,
      periodStart: '2024-06-01',
      periodEnd: '2024-06-30',
      taxYear: 2024,
      bindings: [
        historicalLhNr,
        {
          payrollTaxNumber: '987654321L02',
          isPrimary: true,
          validFrom: '2024-06-01',
          validUntil: '2024-12-31',
        },
      ],
    })).toMatchObject({ status: 'BLOCKED', code: 'LHNR_BINDING_AMBIGUOUS' })
  })

  it.each([
    ['een ander volledig LhNr', { payrollTaxNumber: '987654321L02', periodStart: '2024-01-01', periodEnd: '2024-01-31', taxYear: 2024 }, 'LHNR_SCOPE_MISMATCH'],
    ['een tijdvak buiten de binding', { payrollTaxNumber: historicalLhNr.payrollTaxNumber, periodStart: '2025-01-01', periodEnd: '2025-01-31', taxYear: 2025 }, 'LHNR_PERIOD_NOT_COVERED'],
    ['een ontbrekend tijdvak', { payrollTaxNumber: historicalLhNr.payrollTaxNumber, periodStart: null, periodEnd: null, taxYear: 2024 }, 'IMPORT_PERIOD_REQUIRED'],
    ['een onvolledig LhNr', { payrollTaxNumber: '123456789', periodStart: '2024-01-01', periodEnd: '2024-01-31', taxYear: 2024 }, 'LHNR_INVALID'],
  ] as const)('blokkeert %s', (_description, input, code) => {
    expect(checkHistoricalLhNr({ ...input, bindings: [historicalLhNr] })).toMatchObject({ status: 'BLOCKED', code })
  })

  it('geeft WARNING voor een bron die parsebaar is maar nog geen formele XSD-validatie claimt', () => {
    const result = evaluatePayrollImportReadiness(readyInput({
      bindings: [currentLhNr, historicalLhNr],
      source: source({ formallyValidated: false }),
    }))

    expect(result.status).toBe('WARNING')
    expect(result.isReady).toBe(false)
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SOURCE_FORMAL_VALIDATION_PENDING', status: 'WARNING' }),
    ]))
  })

  it('controleert een historisch XML-tijdvak zonder actuele LhNr-binding te eisen', () => {
    const result = evaluatePayrollImportReadiness(readyInput({
      bindings: [historicalLhNr],
      source: source({ formallyValidated: false }),
    }))

    expect(result.status).toBe('WARNING')
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'PAYROLL_TAX_NUMBER', status: 'NOT_REQUIRED' }),
      expect.objectContaining({ key: 'SOURCE_LHNR_PERIOD', status: 'READY' }),
    ]))
  })

  it('blokkeert een gekozen belastingjaar dat afwijkt van het XML-bronjaar', () => {
    const result = evaluatePayrollImportReadiness(readyInput({
      bindings: [historicalLhNr],
      source: source({ requestedTaxYear: 2026 }),
    }))

    expect(result.status).toBe('BLOCKED')
    expect(result.checks).toContainEqual(expect.objectContaining({
      key: 'SOURCE_SUPPORT', status: 'BLOCKED', code: 'IMPORT_TAX_YEAR_SELECTION_MISMATCH',
    }))
  })

  it('markeert afgewezen XML als REJECTED en niet als ontbrekende bronregistry', () => {
    const result = evaluatePayrollImportReadiness(readyInput({
      source: source({ parseStatus: 'REJECTED', supported: false }),
    }))

    expect(result.status).toBe('BLOCKED')
    expect(result.checks).toContainEqual(expect.objectContaining({ key: 'SOURCE_SUPPORT', code: 'SOURCE_REJECTED' }))
  })

  it('geeft NOT_REQUIRED voor bronafhankelijke checks zonder XML-analyse', () => {
    const result = evaluatePayrollImportReadiness(readyInput())
    expect(result.status).toBe('READY')
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'SOURCE_SUPPORT', status: 'NOT_REQUIRED' }),
    ]))
  })

  it('blokkeert wanneer actieve context of importrecht ontbreekt', () => {
    const result = evaluatePayrollImportReadiness(readyInput({
      hasActiveHrGroup: false,
      hasActiveAdministration: false,
      hasImportPermission: false,
    }))

    expect(result.status).toBe('BLOCKED')
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'ACTIVE_HR_GROUP', code: 'ACTIVE_HR_GROUP_REQUIRED' }),
      expect.objectContaining({ key: 'ACTIVE_ADMINISTRATION', code: 'ACTIVE_ADMINISTRATION_REQUIRED' }),
      expect.objectContaining({ key: 'IMPORT_PERMISSION', code: 'IMPORT_PERMISSION_REQUIRED' }),
      expect.objectContaining({ key: 'PAYROLL_TAX_NUMBER', status: 'NOT_REQUIRED' }),
    ]))
  })
})
type FakeResult = { data: unknown; error: null | { message: string } }

class FakeQuery {
  constructor(private readonly table: string, private readonly result: FakeResult, private readonly calls: string[]) {}

  select(): this {
    this.calls.push(`${this.table}.select`)
    return this
  }

  eq(column: string, value: unknown): this {
    this.calls.push(`${this.table}.eq:${column}=${String(value)}`)
    return this
  }

  order(column: string): this {
    this.calls.push(`${this.table}.order:${column}`)
    return this
  }

  limit(value: number): this {
    this.calls.push(`${this.table}.limit:${value}`)
    return this
  }

  maybeSingle(): Promise<FakeResult> {
    return Promise.resolve(this.result)
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}

function auth(permissions: string[]): AuthContext {
  return {
    tenantId: 'tenant-1',
    hrGroupId: 'group-1',
    administrationId: 'admin-1',
    userId: 'user-1',
    employeeId: null,
    activeRoles: ['HR_ADMIN'],
    permissions,
  }
}

function fakeDependencies(
  permissions: string[] = ['payroll-import:write'],
  options: { bindings?: readonly PayrollTaxNumberBinding[]; activeHrGroup?: boolean; activeAdministration?: boolean } = {},
): { dependencies: PayrollImportReadinessDependencies; calls: string[] } {
  const calls: string[] = []
  const bindings = options.bindings ?? [currentLhNr]
  const client = {
    from(table: string): FakeQuery {
      if (table === 'hr_groups') {
        return new FakeQuery(table, { data: options.activeHrGroup === false ? null : { id: 'group-1' }, error: null }, calls)
      }
      if (table === 'administrations') {
        return new FakeQuery(table, { data: options.activeAdministration === false ? null : { id: 'admin-1' }, error: null }, calls)
      }
      if (table === 'administration_payroll_tax_numbers') {
        return new FakeQuery(table, {
          data: bindings.map((binding) => ({
            payroll_tax_number: binding.payrollTaxNumber,
            is_primary: binding.isPrimary,
            valid_from: binding.validFrom,
            valid_until: binding.validUntil,
          })),
          error: null,
        }, calls)
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  }

  return {
    dependencies: { auth: auth(permissions), supabase: client as unknown as PayrollImportReadinessDependencies['supabase'] },
    calls,
  }
}

describe('CONTROL02 readiness server projection', () => {
  it('leest alleen actieve context en LhNr-configuratie', async () => {
    const { dependencies, calls } = fakeDependencies()
    const result = await getPayrollImportReadiness({ dependencies, asOf: '2026-10-03' })

    expect(result).toMatchObject({ status: 'READY', isReady: true, payrollTaxNumber: currentLhNr.payrollTaxNumber })
    expect(calls.some((call) => call.includes('.insert') || call.includes('.update'))).toBe(false)
    expect(calls).toEqual(expect.arrayContaining([
      'hr_groups.select',
      'administrations.select',
      'administration_payroll_tax_numbers.select',
    ]))
  })

  it('weigert ontbrekend importrecht vóór er contextdata wordt gelezen', async () => {
    const { dependencies, calls } = fakeDependencies([])

    await expect(getPayrollImportReadiness({ dependencies })).rejects.toMatchObject({ status: 403 })
    expect(calls).toHaveLength(0)
  })

  it('geeft BLOCKED voor een ontbrekende actieve administratie en leest dan geen LhNr-configuratie', async () => {
    const { dependencies, calls } = fakeDependencies(['payroll-import:write'], { activeAdministration: false })
    const result = await getPayrollImportReadiness({ dependencies, asOf: '2026-10-03' })

    expect(result.status).toBe('BLOCKED')
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'ACTIVE_ADMINISTRATION', code: 'ACTIVE_ADMINISTRATION_REQUIRED' }),
    ]))
    expect(calls.some((call) => call.startsWith('administration_payroll_tax_numbers.'))).toBe(false)
  })

  it('kan een oud importtijdvak valideren terwijl de huidige binding recenter is', async () => {
    const { dependencies } = fakeDependencies(['payroll-import:write'], { bindings: [currentLhNr, historicalLhNr] })
    const result = await getPayrollImportReadiness({
      dependencies,
      asOf: '2026-10-03',
      source: source(),
    })

    expect(result.status).toBe('READY')
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'SOURCE_LHNR_PERIOD', status: 'READY' }),
    ]))
  })
})
