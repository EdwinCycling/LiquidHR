import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { copySystemComponentAction } from './actions'

const { copy } = vi.hoisted(() => ({ copy: vi.fn() }))
vi.mock('@/lib/payroll/component-library', () => ({ copySystemComponent: copy }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))
function form(key: string) { const result = new FormData(); result.set('catalogKey', key); return result }
describe('component copy action', () => {
  beforeEach(() => vi.clearAllMocks())
  it('submits only the selected exact server catalog key and opens the saved draft', async () => {
    copy.mockResolvedValue({ id: '10000000-0000-4000-8000-000000000099' })
    await expect(copySystemComponentAction(form('NL-PAYROLL-2026:2026.1::NL_NET_PAY::1'))).rejects.toThrow('redirect:/payroll-components?component=draft%3A%3A10000000-0000-4000-8000-000000000099&ownership=customer&saved=1')
    expect(copy).toHaveBeenCalledWith('NL-PAYROLL-2026:2026.1::NL_NET_PAY::1')
  })
  it.each(['tenantId', 'hrGroupId', 'administrationId', 'definition', 'ownership', 'status'])('rejects forged %s fields before copying', async field => {
    const data = form('SYSTEM')
    data.set(field, 'forged')
    await expect(copySystemComponentAction(data)).rejects.toThrow('redirect:/payroll-components?error=copy-failed')
    expect(copy).not.toHaveBeenCalled()
  })
  it('rejects duplicate catalog keys and customer identities', async () => {
    const data = form('SYSTEM')
    data.append('catalogKey', 'CUSTOM')
    await expect(copySystemComponentAction(data)).rejects.toThrow('copy-failed')
    expect(copy).not.toHaveBeenCalled()
    copy.mockRejectedValue(new Error('SYSTEM_OWNERSHIP_REQUIRED'))
    await expect(copySystemComponentAction(form('draft::fake'))).rejects.toThrow('copy-failed')
  })
  it.each([
    [new AuthenticationError('private'), '/login'],
    [new AuthorizationError('private'), '/geen-toegang'],
    [new Error('private database error'), '/payroll-components?error=copy-failed'],
  ])('uses safe public redirects for authorization and storage failures', async (error, destination) => {
    copy.mockRejectedValue(error)
    await expect(copySystemComponentAction(form('SYSTEM'))).rejects.toThrow(`redirect:${destination}`)
  })
})
