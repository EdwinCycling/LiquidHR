import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import type { WvpCase } from '@/lib/absence/wvp/service'
import { WvpWorkSummary } from './wvp-work-summary'

const mocks = vi.hoisted(() => ({ list: vi.fn(), translator: vi.fn(), locale: vi.fn() }))
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a> }))
vi.mock('@/lib/absence/wvp/service', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/absence/wvp/service')>()
  return { ...original, listWvpCases: mocks.list }
})
vi.mock('@/lib/i18n/server', () => ({ getTranslator: mocks.translator, getLocale: mocks.locale }))

const id = '11111111-1111-4111-8111-111111111111'
const base: WvpCase = {
  id, employeeId: id, employmentId: id, administrationId: id, name: 'Dossier', status: 'ACTIVE',
  firstAbsenceOn: '2026-01-01', clockStartOn: '2026-01-01', pendingConfirmation: false,
  processInstanceId: id, closedAt: null, canManage: true, canConfirm: false, canStartProcess: false,
  isSelf: false, currentMilestone: 'WVP_WEEK_8',
  tasks: [
    { id, code: 'WVP_WEEK_6', dueOn: '2026-02-12', status: 'OPEN', completedAt: null },
    { id: '22222222-2222-4222-8222-222222222222', code: 'WVP_WEEK_8', dueOn: '2026-02-26', status: 'OPEN', completedAt: null },
  ],
  events: [], capacity: [], spells: [],
}

beforeEach(() => {
  mocks.list.mockReset()
  mocks.translator.mockResolvedValue((key: string) => key)
  mocks.locale.mockResolvedValue('nl')
})

it('toont een directe casustaak ook zonder publicatierecht, met mijlpaal en urgentie', async () => {
  mocks.list.mockResolvedValue([base])
  const html = renderToStaticMarkup(await WvpWorkSummary())
  expect(html).toContain('/absence/guidance/' + id)
  expect(html).toContain('wvp.WVP_WEEK_8')
  expect(html).toContain('wvp.OVERDUE')
})

it('toont een medewerker alleen eigen open kennisname en geen casusmijlpalen', async () => {
  const employee: WvpCase = {
    ...base, canManage: false, canConfirm: false, canStartProcess: false, isSelf: true, processInstanceId: null,
    events: [{ id, type: 'AGREEMENT', occurredOn: '2026-01-02', createdAt: '2026-01-02T12:00:00Z', actorUserId: id, taskId: null, agreement: 'ADAPTED_HOURS', reviewOn: '2026-01-20', agreementId: null }],
  }
  mocks.list.mockResolvedValue([employee])
  const html = renderToStaticMarkup(await WvpWorkSummary())
  expect(html).toContain('wvp.acknowledge')
  expect(html).not.toContain('wvp.WVP_WEEK_8')
})
