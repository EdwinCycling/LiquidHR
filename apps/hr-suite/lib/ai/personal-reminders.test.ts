import { describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import {
  executePersonalReminderTool,
  parsePersonalReminderToolArguments,
  type PersonalReminderCapabilityDependencies,
} from './personal-reminders'

const auth: AuthContext = {
  tenantId: 'tenant-1',
  hrGroupId: 'hr-group-1',
  administrationId: 'administration-1',
  userId: 'user-1',
  employeeId: 'employee-1',
  activeRoles: ['DIRECT_MANAGER'],
  permissions: ['ai:use'],
}

function futureReminderTime(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString()
}

function dependencies(): PersonalReminderCapabilityDependencies {
  return {
    createPersonalReminder: vi.fn().mockResolvedValue('reminder-1'),
    recordAudit: vi.fn().mockResolvedValue(undefined),
  }
}

describe('personal reminder AI capability', () => {
  it('accepts only actor-owned reminder fields and an explicit confirmation', () => {
    expect(parsePersonalReminderToolArguments({
      title: 'Bel HR terug',
      description: 'Bespreek de openstaande vraag.',
      remindAt: futureReminderTime(),
      confirmation: 'EXPLICIT_REQUEST',
    })).toMatchObject({ title: 'Bel HR terug', confirmation: 'EXPLICIT_REQUEST' })
  })

  it('normalizes the strict-schema null description to the optional service shape', () => {
    expect(parsePersonalReminderToolArguments({
      title: 'Bel HR terug',
      description: null,
      remindAt: futureReminderTime(),
      confirmation: 'EXPLICIT_REQUEST',
    })).toMatchObject({ title: 'Bel HR terug', description: undefined })
  })

  it.each([
    {},
    { title: 'Onvolledig', confirmation: 'EXPLICIT_REQUEST' },
    { title: 'Geen bevestiging', remindAt: futureReminderTime() },
    { title: 'Geen actor spoof', remindAt: futureReminderTime(), confirmation: 'EXPLICIT_REQUEST', userId: 'other-user' },
    { title: 'Geen employee spoof', remindAt: futureReminderTime(), confirmation: 'EXPLICIT_REQUEST', employeeId: 'other-employee' },
    { title: 'Geen tenant spoof', remindAt: futureReminderTime(), confirmation: 'EXPLICIT_REQUEST', tenantId: 'other-tenant' },
    { title: 'Geen team target', remindAt: futureReminderTime(), confirmation: 'EXPLICIT_REQUEST', departmentId: 'department-1' },
  ])('rejects an incomplete or targeted model payload without a write', (value) => {
    expect(() => parsePersonalReminderToolArguments(value)).toThrow()
  })

  it('writes through the existing personal reminder service and returns the structured result', async () => {
    const deps = dependencies()
    const result = await executePersonalReminderTool({
      auth,
      source: 'EMPLOYEE_AI',
      locale: 'nl',
      arguments: {
        title: 'Bel HR terug',
        description: 'Bespreek de openstaande vraag.',
        remindAt: futureReminderTime(),
        confirmation: 'PROPOSAL_ACCEPTED',
      },
    }, deps)

    expect(deps.createPersonalReminder).toHaveBeenCalledWith({
      title: 'Bel HR terug',
      description: 'Bespreek de openstaande vraag.',
      remindAt: expect.any(String),
    })
    expect(deps.createPersonalReminder).toHaveBeenCalledWith(expect.not.objectContaining({
      tenantId: expect.anything(),
      userId: expect.anything(),
      employeeId: expect.anything(),
      departmentId: expect.anything(),
    }))
    expect(result).toMatchObject({ reminderId: 'reminder-1', title: 'Bel HR terug', created: true })
    expect(result.remindAt).toEqual(expect.any(String))
    expect(result.resultText).toContain('Herinnering')
    expect(deps.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      reminderId: 'reminder-1',
      source: 'EMPLOYEE_AI',
      capability: 'create_personal_reminder',
      success: true,
    }))
  })

  it('never reports success when the existing reminder write fails', async () => {
    const deps = dependencies()
    deps.createPersonalReminder = vi.fn().mockRejectedValue(new Error('database failure'))

    await expect(executePersonalReminderTool({
      auth,
      source: 'TEAM_AI',
      locale: 'en',
      arguments: { title: 'Follow up', remindAt: futureReminderTime(), confirmation: 'EXPLICIT_REQUEST' },
    }, deps)).rejects.toMatchObject({ code: 'PERSONAL_REMINDER_FAILED', status: 422 })
    expect(deps.recordAudit).not.toHaveBeenCalled()
  })
})
