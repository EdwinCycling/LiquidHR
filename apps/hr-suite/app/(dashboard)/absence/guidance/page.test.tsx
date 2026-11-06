import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ permission: vi.fn(), list: vi.fn(), redirect: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/auth/permissions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/permissions')>('@/lib/auth/permissions')
  return { ...actual, requirePermission: mocks.permission }
})
vi.mock('@/lib/absence/wvp/service', () => ({ listWvpCases: mocks.list, WvpError: class extends Error {} }))
vi.mock('@/lib/i18n/server', () => ({ getTranslator: async () => (key: string) => key, getLocale: async () => 'nl' }))
vi.mock('@/components/ui/dropdown-select', () => ({ DropdownSelect: () => null }))

import { AuthorizationError } from '@/lib/auth/permissions'
import GuidancePage from './page'

const cases = [
  { id: 'later', name: 'Later', status: 'ACTIVE', closedAt: null, currentMilestone: null, tasks: [{ id: 't1', code: 'WVP_WEEK_6', dueOn: '2026-12-01', status: 'OPEN' }] },
  { id: 'first', name: 'Eerder', status: 'ACTIVE', closedAt: null, currentMilestone: null, tasks: [{ id: 't2', code: 'WVP_WEEK_8', dueOn: '2026-01-01', status: 'OPEN' }] },
  { id: 'missing', name: 'Onbekend', status: 'ACTIVE', closedAt: null, currentMilestone: null, tasks: [] },
]
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-06T12:00:00Z')); mocks.permission.mockReset().mockResolvedValue({}); mocks.list.mockReset().mockResolvedValue(cases); mocks.redirect.mockReset() })
afterEach(() => vi.useRealTimers())

it('requires non-self absence read before requesting the case list', async () => {
  mocks.permission.mockRejectedValue(new AuthorizationError('denied'))
  mocks.redirect.mockImplementation(() => { throw new Error('redirect') })
  await expect(GuidancePage({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect')
  expect(mocks.permission).toHaveBeenCalledWith('absence:read')
  expect(mocks.list).not.toHaveBeenCalled()
})

it('sorts deadlines, supports urgency filters and identifies missing source data', async () => {
  const html = renderToStaticMarkup(await GuidancePage({ searchParams: Promise.resolve({}) }))
  expect(html.indexOf('Eerder')).toBeLessThan(html.indexOf('Later'))
  expect(html).toContain('wvp.controlUnknown')
  const filtered = renderToStaticMarkup(await GuidancePage({ searchParams: Promise.resolve({ urgency: 'OVERDUE' }) }))
  expect(filtered).toContain('Eerder')
  expect(filtered).not.toContain('Later')
})
