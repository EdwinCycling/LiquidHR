import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  permissionErrorResponse: vi.fn(),
  resolveAdministration: vi.fn(),
  scopeFromContext: vi.fn(),
  getLatest: vi.fn(),
  isCase: vi.fn(),
  isRunId: vi.fn(),
  isCompatible: vi.fn(),
  buildPack: vi.fn(),
  renderPdf: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  requirePermission: mocks.requirePermission,
  permissionErrorResponse: mocks.permissionErrorResponse,
}))
vi.mock('@/lib/payroll/access', () => ({
  PayrollLabUnavailableError: class PayrollLabUnavailableError extends Error {},
  resolvePayrollLabAdministration: mocks.resolveAdministration,
}))
vi.mock('@/lib/payroll/scope', () => ({ payrollScopeFromAuthContext: mocks.scopeFromContext }))
vi.mock('@/lib/payroll/cao-bench02-calculation-service', () => ({ getLatestCaoBench02Payroll: mocks.getLatest }))
vi.mock('@/lib/payroll/validation-pack', () => ({
  ValidationPackError: class ValidationPackError extends Error {},
  buildCaoBench02ValidationPack: mocks.buildPack,
  isValidationPackCaseKey: mocks.isCase,
  isValidationPackCompatibleRun: mocks.isCompatible,
  isValidationPackRunId: mocks.isRunId,
}))
vi.mock('@/lib/payroll/validation-pack-pdf', () => ({ renderCaoBench02ValidationPackPdf: mocks.renderPdf }))

import { NextRequest, NextResponse } from 'next/server'
import { GET } from './route'

const APPLICATION_URL = 'http://localhost:3000'
const CASE_KEY = 'CAO-BENCH02-K1'
const RUN_ID = '44444444-4444-4444-8444-444444444444'
const ADMIN_ID = '55555555-5555-4555-8555-555555555555'
const CONTEXT = { tenantId: 't', hrGroupId: 'g', administrationId: 'a', userId: 'u', permissions: ['salary:read'] }
const SCOPE = { tenantId: '1', hrGroupId: '2', administrationId: '3' }
const ADMIN = { id: ADMIN_ID, capabilityEnabled: true, status: 'ACTIVE' }
const VIEW = { runId: RUN_ID, caseKey: CASE_KEY, payrollAdministrationId: ADMIN_ID, status: 'SUCCEEDED' }
const PACK = { schemaVersion: 'liquidhr.payroll-validation-pack.v1', run: { runId: RUN_ID } }

function request(query: string): NextRequest {
  return new NextRequest(`${APPLICATION_URL}/api/payroll-lab/validation-pack?${query}`)
}

describe('GET /api/payroll-lab/validation-pack', () => {
  beforeEach(() => {
    mocks.requirePermission.mockReset().mockResolvedValue(CONTEXT)
    mocks.permissionErrorResponse.mockReset().mockReturnValue(null)
    mocks.resolveAdministration.mockReset().mockResolvedValue(ADMIN)
    mocks.scopeFromContext.mockReset().mockReturnValue(SCOPE)
    mocks.getLatest.mockReset().mockResolvedValue(VIEW)
    mocks.isCase.mockReset().mockImplementation((value: string) => value === CASE_KEY)
    mocks.isRunId.mockReset().mockImplementation((value: string) => /^[0-9a-f-]{36}$/i.test(value))
    mocks.isCompatible.mockReset().mockReturnValue(true)
    mocks.buildPack.mockReset().mockReturnValue(PACK)
    mocks.renderPdf.mockReset().mockResolvedValue(Buffer.from('%PDF-1.7\nvalidation pack'))
  })

  afterEach(() => vi.restoreAllMocks())

  it('returns an authorized exact-run JSON attachment with private no-store headers', async () => {
    const response = await GET(request(`caseKey=${CASE_KEY}&runId=${RUN_ID}&format=json`))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-disposition')).toContain(`${CASE_KEY.toLowerCase()}-${RUN_ID}-validation-pack.json`)
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await response.json()).toEqual(PACK)
    expect(mocks.requirePermission).toHaveBeenCalledWith('salary:read')
    expect(mocks.resolveAdministration).toHaveBeenCalledWith(CONTEXT)
    expect(mocks.getLatest).toHaveBeenCalledWith(SCOPE, ADMIN_ID, CASE_KEY, RUN_ID)
    expect(mocks.isCompatible).toHaveBeenCalledWith(CASE_KEY, RUN_ID, ADMIN_ID, VIEW)
    expect(mocks.buildPack).toHaveBeenCalledWith(CASE_KEY, ADMIN_ID, VIEW)
    expect(mocks.renderPdf).not.toHaveBeenCalled()
  })

  it.each([
    `caseKey=CAO-BENCH02-H1&runId=${RUN_ID}&format=json`,
    `caseKey=${CASE_KEY}&runId=not-a-uuid&format=json`,
    `caseKey=${CASE_KEY}&runId=${RUN_ID}&format=csv`,
    `caseKey=${CASE_KEY}&caseKey=${CASE_KEY}&runId=${RUN_ID}&format=json`,
    `caseKey=${CASE_KEY}&runId=${RUN_ID}&format=json&tenantId=1`,
  ])('rejects an invalid or scope-bearing query: %s', async (query) => {
    const response = await GET(request(query))

    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'PAYROLL_VALIDATION_PACK_INPUT_INVALID' })
    expect(mocks.requirePermission).not.toHaveBeenCalled()
    expect(mocks.getLatest).not.toHaveBeenCalled()
  })

  it('does not load a run when the Payroll scope is unavailable', async () => {
    mocks.scopeFromContext.mockReturnValueOnce(null)

    const response = await GET(request(`caseKey=${CASE_KEY}&runId=${RUN_ID}&format=json`))

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mocks.getLatest).not.toHaveBeenCalled()
  })

  it('does not load a run when Payroll Lab administration access is disabled', async () => {
    mocks.resolveAdministration.mockResolvedValueOnce(null)

    const response = await GET(request(`caseKey=${CASE_KEY}&runId=${RUN_ID}&format=json`))

    expect(response.status).toBe(404)
    expect(mocks.getLatest).not.toHaveBeenCalled()
  })

  it.each(['run-mismatch', 'failed-run'])('rejects %s before building the pack', async () => {
    mocks.isCompatible.mockReturnValueOnce(false)

    const response = await GET(request(`caseKey=${CASE_KEY}&runId=${RUN_ID}&format=json`))

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mocks.buildPack).not.toHaveBeenCalled()
  })

  it('returns a generated PDF attachment without a public object link', async () => {
    const response = await GET(request(`caseKey=${CASE_KEY}&runId=${RUN_ID}&format=pdf`))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-disposition')).toContain('.pdf')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(Buffer.from(await response.arrayBuffer()).toString('latin1')).toContain('%PDF-1.7')
    expect(mocks.renderPdf).toHaveBeenCalledWith(PACK)
  })

  it('preserves the existing authorization response and makes it non-cacheable', async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error('denied'))
    mocks.permissionErrorResponse.mockReturnValueOnce(NextResponse.json({ error: 'forbidden' }, { status: 403 }))

    const response = await GET(request(`caseKey=${CASE_KEY}&runId=${RUN_ID}&format=json`))

    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(mocks.getLatest).not.toHaveBeenCalled()
  })
})
