// @vitest-environment happy-dom

import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmploymentCreationOptions } from '@/lib/employment/employment-service'
import { EmploymentCreateForm, resolveFulltimeSalaryAmount, type EmploymentCreateFormProps } from './employment-create-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

const labels = new Proxy({
  next: 'Volgende', previous: 'Vorige', submit: 'Dienstverband maken', skipPayrollDetails: 'Overslaan',
}, { get: (target, property) => target[property as keyof typeof target] ?? String(property) }) as EmploymentCreateFormProps['labels']

const options: EmploymentCreationOptions = {
  administrations: [{ activeEmployeeCount: 0, administrationNumber: '1', archivedEmployeeCount: 0, availableLaborConditions: [], code: 'J1', cocNumber: null, id: 'administration-1', name: 'Jupiter BV', vatNumber: null }],
  canWriteSalary: false,
  costCarriers: [{ code: 'GENERAL', id: 'carrier-1', name: 'General' }],
  costCenters: [{ code: 'GENERAL', id: 'center-1', name: 'General' }],
  defaultCountryCode: 'NL', defaultStartDate: '2026-09-01', departments: [{ code: 'OPS', id: 'department-1', name: 'Operations' }],
  departmentManagers: { 'department-1': [{ employeeNumber: 'DEMO-001', id: 'manager-1', name: 'Manager' }] }, flexPhases: [], hasActivePrimaryEmployment: false,
  jobGroups: [{ code: 'BOARD', id: 'group-1', name: 'Board' }], jobs: [{ code: 'M1', id: 'job-1', jobGroupId: 'group-1', name: 'Manager' }],
  laborConditionSalaryStructureIds: { 'labor-1': [] }, laborConditionSets: [{ code: 'COMPANY', id: 'labor-1', name: 'Company', probationMaximumMonths: 1, standardHoursPerWeek: 40 }],
  managers: [], minimumWageRates: [], nextEmploymentNumber: '1', nextIkvNumber: 1,
  prerequisites: { birthDate: '1990-01-01', employeeNumber: '100017', gender: 'MALE', hasBsn: true, nationality: 'NL', updatedAt: '2026-09-01T00:00:00.000Z' },
  rehireDefaults: null, salaryBands: [], salaryFrequencies: [], salaryRoutes: [], salaryScaleSteps: [], salaryScales: [], salaryStructureIds: [], selectedAdministrationId: 'administration-1',
}

function view(): ReactElement {
  return <EmploymentCreateForm employeeId="employee-1" options={options} labels={labels} locale="nl-NL" dateFormat="DMY" showPayrollChoice />
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const target = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label)
  if (!target) throw new Error(`Button not found: ${label}`)
  return target
}

describe('EmploymentCreateForm final review', () => {
  let container: HTMLDivElement
  let root: Root
  let originalFetch: typeof fetch

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    root.unmount()
    container.remove()
    globalThis.fetch = originalFetch
  })

  it('does not publish on entering, revisiting, rerendering, or submitting the final review form', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock
    await act(async () => { root.render(view()) })

    await act(async () => { button(container, 'Volgende').click() })
    const employmentType = container.querySelector('select')
    if (!employmentType) throw new Error('Employment type selector not found')
    employmentType.value = 'EMPLOYEE'
    await act(async () => { employmentType.dispatchEvent(new Event('change', { bubbles: true })) })
    await act(async () => { button(container, 'Volgende').click() })
    await act(async () => { button(container, 'Overslaan').click() })

    expect(container.textContent).toContain('completeSummary')
    expect(fetchMock).not.toHaveBeenCalled()
    const form = container.querySelector('form')
    if (!form) throw new Error('Employment form not found')
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await act(async () => { root.render(view()) })
    await act(async () => { button(container, 'Vorige').click() })
    await act(async () => { button(container, 'Overslaan').click() })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps a manually entered fulltime salary when a scale step is preselected', () => {
    expect(resolveFulltimeSalaryAmount('MANUAL', 3500, '4000')).toBe(4000)
    expect(resolveFulltimeSalaryAmount('CUSTOM_SCALE', 3500, '4000')).toBe(3500)
  })

  it('publishes once per explicit final CTA, blocks a double click, and allows one retry after failure', async () => {
    let resolveFirstRequest: ((response: Response) => void) | undefined
    const fetchMock = vi.fn<typeof fetch>(() => new Promise<Response>((resolve) => { resolveFirstRequest = resolve }))
    globalThis.fetch = fetchMock
    await act(async () => { root.render(view()) })
    await act(async () => { button(container, 'Volgende').click() })
    const employmentType = container.querySelector('select')
    if (!employmentType) throw new Error('Employment type selector not found')
    employmentType.value = 'EMPLOYEE'
    await act(async () => { employmentType.dispatchEvent(new Event('change', { bubbles: true })) })
    await act(async () => { button(container, 'Volgende').click() })
    await act(async () => { button(container, 'Overslaan').click() })

    const submit = button(container, 'Dienstverband maken')
    await act(async () => { submit.click(); submit.click() })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/employees/employee-1/employments')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' })

    if (!resolveFirstRequest) throw new Error('First request was not started')
    resolveFirstRequest(new Response(JSON.stringify({ code: 'EMPLOYMENT_CREATE_FAILED' }), { status: 500 }))
    await act(async () => {})
    await act(async () => { button(container, 'Dienstverband maken').click() })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
