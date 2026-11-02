import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), permission: vi.fn() }))
vi.mock('@/lib/auth/permissions', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/auth/permissions')>()
  return { ...original, requireAnyPermission: mocks.auth, requireAuthContext: mocks.auth, requirePermission: mocks.permission }
})
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: mocks.rpc }) }))
import { executeWvpCommand, listWvpCases, WvpError } from './service'
const id = '11111111-1111-4111-8111-111111111111'
beforeEach(() => {
  mocks.rpc.mockReset()
  mocks.auth.mockResolvedValue({ tenantId: id, hrGroupId: id, administrationId: id, permissions: [] })
})
it('meldt ontbrekende schemafunctie expliciet zonder succesvolle fallback', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'missing function' } })
  await expect(listWvpCases()).rejects.toMatchObject({ code: 'WVP_SCHEMA_REQUIRED', status: 503 })
})
it('geeft tenant, HR-groep, administratie en casefilter door aan de beveiligde RPC', async () => {
  mocks.rpc.mockResolvedValue({ data: [], error: null })
  expect(await listWvpCases(id)).toEqual([])
  expect(mocks.rpc).toHaveBeenCalledWith('wvp_list', { requested_tenant_id: id, requested_hr_group_id: id, requested_administration_id: id, requested_case_id: id })
})
it('behandelt een ontbrekende actor-medewerkermapping als geen eigen casus', async () => {
  const legacyCaseId = 'd2aa7eb2-f236-b403-b0bb-16ead3e3f1b9'
  mocks.rpc.mockResolvedValue({ data: [{
    id: legacyCaseId, employeeId: '8483abc9-f275-c80b-5a23-fedc54ce9f0a', employmentId: 'd2aa7eb2-f236-b403-b0bb-16ead3e3f1b9', administrationId: '8483abc9-f275-c80b-5a23-fedc54ce9f0a', name: 'Synthetische medewerker', status: 'CLOSED',
    firstAbsenceOn: '2026-01-01', clockStartOn: '2026-01-01', pendingConfirmation: false,
    processInstanceId: null, closedAt: null, canManage: true, isSelf: null, currentMilestone: null,
    tasks: [], events: [], capacity: [], spells: [],
  }], error: null })
  await expect(listWvpCases(legacyCaseId)).resolves.toMatchObject([{ id: legacyCaseId, isSelf: false, canConfirm: false }])
  expect(mocks.rpc).toHaveBeenCalledWith('wvp_list', expect.objectContaining({ requested_case_id: legacyCaseId }))
})
it('weigert verborgen of onbekende cases vóór mutatie of procesdefinitie', async () => {
  mocks.rpc.mockResolvedValue({ data: [], error: null })
  await expect(executeWvpCommand({ action: 'START', caseId: id })).rejects.toMatchObject({ code: 'WVP_FORBIDDEN', status: 403 })
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
})
it('weigert medische velden vóór iedere auth- of databaseaanroep', async () => {
  const before = mocks.auth.mock.calls.length
  await expect(executeWvpCommand({ action: 'START', caseId: id, diagnosis: 'niet opslaan' })).rejects.toThrow()
  expect(mocks.auth.mock.calls.length).toBe(before)
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('geeft geen interne RPC-foutinhoud of data door aan de client', async () => {
  mocks.rpc.mockResolvedValue({ error: { message: 'internal details', code: 'XX000' } })
  try { await listWvpCases(); throw new Error('expected failure') }
  catch (error) { expect(error).toBeInstanceOf(WvpError); expect((error as WvpError).message).toBe('WVP_OPERATION_FAILED') }
})
