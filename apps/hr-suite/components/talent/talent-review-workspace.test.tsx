// @vitest-environment happy-dom

import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TalentReviewWorkspace, type TalentReviewLabels } from './talent-review-workspace'
import type { TalentReviewScore, TalentReviewWorkspace as ReviewWorkspace } from '@/lib/talent-review/service'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const campaignId = '00000000-0000-4000-8000-000000000001'
const firstEmployeeId = '00000000-0000-4000-8000-000000000002'
const secondEmployeeId = '00000000-0000-4000-8000-000000000003'
const labels = new Proxy<Partial<TalentReviewLabels>>({
  campaigns: 'Campaigns', performance: 'Performance', potential: 'Potential',
  low: 'Low', normal: 'Normal', high: 'High', saveDraft: 'Save draft',
}, { get: (target, key) => target[key as keyof TalentReviewLabels] ?? String(key) }) as TalentReviewLabels

const workspace: ReviewWorkspace = {
  campaigns: [{ id: campaignId, name: 'T01R test', description: null, starts_on: '2026-09-27', ends_on: '2026-10-03', status: 'ACTIVE', review_mode: 'MANAGER_ONLY', previous_campaign_id: null, version: 1, started_at: null, closed_at: null, reopened_at: null }],
  selectedCampaignId: campaignId,
  assignments: [{ id: '00000000-0000-4000-8000-000000000004', campaign_id: campaignId, manager_employee_id: '00000000-0000-4000-8000-000000000005', status: 'IN_PROGRESS', employee_count: 2, scored_count: 0, submitted_at: null, submitted_by_user_id: null, return_reason: null, returned_at: null, returned_by_user_id: null, last_reminded_at: null, version: 1, managerLabel: 'Manager' }],
  members: [
    { id: firstEmployeeId, label: 'First employee', employeeNumber: 'TEST-001', jobTitle: 'Tester', avatarUrl: null, snapshot: {}, assignmentId: '00000000-0000-4000-8000-000000000004', managerEmployeeId: '00000000-0000-4000-8000-000000000005' },
    { id: secondEmployeeId, label: 'Second employee', employeeNumber: 'TEST-002', jobTitle: 'Tester', avatarUrl: null, snapshot: {}, assignmentId: '00000000-0000-4000-8000-000000000004', managerEmployeeId: '00000000-0000-4000-8000-000000000005' },
  ],
  scores: [],
  previousScores: [],
}

function mount(element: ReactNode): { host: HTMLDivElement; root: Root } {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(element))
  return { host, root }
}

function unmount(host: HTMLDivElement, root: Root): void {
  act(() => root.unmount())
  host.remove()
  document.querySelectorAll('[role="listbox"]').forEach((element) => element.remove())
}

function choose(host: HTMLDivElement, label: string, optionLabel: string): void {
  const trigger = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  expect(trigger).not.toBeNull()
  act(() => trigger?.click())
  const option = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="option"]')).find((candidate) => candidate.textContent?.trim() === optionLabel)
  expect(option).toBeDefined()
  act(() => option?.click())
}

describe('TalentReviewWorkspace score draft', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('loads a clean draft when the manager selects a different employee', () => {
    const { host, root } = mount(createElement(TalentReviewWorkspace, { initial: workspace, labels, mode: 'manager' }))
    try {
      const firstEmployee = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('First employee'))
      expect(firstEmployee).toBeDefined()
      act(() => firstEmployee?.click())
      choose(host, 'Performance', 'Low')
      choose(host, 'Potential', 'High')
      expect(host.querySelector<HTMLButtonElement>('button[aria-label="Performance"]')?.textContent).toContain('Low')
      expect(host.querySelector<HTMLButtonElement>('button[aria-label="Potential"]')?.textContent).toContain('High')

      const secondEmployee = Array.from(host.querySelectorAll<HTMLButtonElement>('button[aria-pressed="false"]')).find((button) => button.textContent?.includes('Second employee'))
      expect(secondEmployee).toBeDefined()
      act(() => secondEmployee?.click())

      expect(host.querySelector<HTMLButtonElement>('button[aria-label="Performance"]')?.textContent).toContain('—')
      expect(host.querySelector<HTMLButtonElement>('button[aria-label="Potential"]')?.textContent).toContain('—')
    } finally {
      unmount(host, root)
    }
  })

  it('uses the refreshed score version on the next save', async () => {
    let saveCount = 0
    const payloads: Array<{ version?: number }> = []
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/scores/')) {
        payloads.push(JSON.parse(String(init?.body)) as { version?: number })
        saveCount += 1
        return Promise.resolve(new Response(null, { status: 200 }))
      }

      const score: TalentReviewScore = {
        id: '00000000-0000-4000-8000-000000000006',
        campaign_id: campaignId,
        assignment_id: '00000000-0000-4000-8000-000000000004',
        employee_id: firstEmployeeId,
        manager_employee_id: '00000000-0000-4000-8000-000000000005',
        performance_score: 'NORMAL',
        potential_score: 'NORMAL',
        grid_cell: 'NORMAL_NORMAL',
        note: null,
        acting_reason: null,
        status: 'DRAFT',
        version: saveCount,
        updated_at: '2026-09-27T10:00:00Z',
      }
      return Promise.resolve(new Response(JSON.stringify({ data: { ...workspace, scores: [score] } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const { host, root } = mount(createElement(TalentReviewWorkspace, { initial: workspace, labels, mode: 'manager' }))
    try {
      const firstEmployee = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('First employee'))
      act(() => firstEmployee?.click())
      const getSaveButton = () => Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('Save draft'))
      expect(getSaveButton()).toBeDefined()

      await act(async () => {
        getSaveButton()?.click()
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      await act(async () => {
        getSaveButton()?.click()
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      expect(payloads).toHaveLength(2)
      expect(payloads[0]?.version).toBeUndefined()
      expect(payloads[1]?.version).toBe(1)
    } finally {
      unmount(host, root)
    }
  })

  it('places a selected employee by dropping them into a highlighted cell', async () => {
    const scoreRequests: Array<{ performanceScore: string; potentialScore: string; note: string | null }> = []
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/scores/')) {
        scoreRequests.push(JSON.parse(String(init?.body)) as { performanceScore: string; potentialScore: string; note: string | null })
        return Promise.resolve(new Response(JSON.stringify({ data: { id: 'score-1' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      }
      return Promise.resolve(new Response(JSON.stringify({ data: workspace }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const { host, root } = mount(createElement(TalentReviewWorkspace, { initial: workspace, labels, mode: 'manager' }))
    try {
      const employee = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('First employee'))
      const cell = host.querySelector<HTMLDivElement>('div[role="group"][aria-label^="cellHighHigh"]')
      expect(employee).toBeDefined()
      expect(cell).not.toBeNull()

      const transfer = { effectAllowed: '', dropEffect: '', setData: vi.fn(), getData: vi.fn(() => firstEmployeeId) }
      const dragStart = new Event('dragstart', { bubbles: true })
      Object.defineProperty(dragStart, 'dataTransfer', { value: transfer })
      act(() => employee?.dispatchEvent(dragStart))

      const dragOver = new Event('dragover', { bubbles: true, cancelable: true })
      Object.defineProperty(dragOver, 'dataTransfer', { value: transfer })
      act(() => cell?.dispatchEvent(dragOver))
      expect(host.textContent).toContain('dropHere')

      const drop = new Event('drop', { bubbles: true, cancelable: true })
      Object.defineProperty(drop, 'dataTransfer', { value: transfer })
      await act(async () => {
        cell?.dispatchEvent(drop)
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      expect(scoreRequests).toEqual([{ performanceScore: 'HIGH', potentialScore: 'HIGH', note: null }])
    } finally {
      unmount(host, root)
    }
  })

  it('shows only the review tab to managers and locks a submitted assignment', () => {
    const assignmentId = '00000000-0000-4000-8000-000000000004'
    const submittedScore: TalentReviewScore = {
      id: '00000000-0000-4000-8000-000000000006',
      campaign_id: campaignId,
      assignment_id: assignmentId,
      employee_id: firstEmployeeId,
      manager_employee_id: '00000000-0000-4000-8000-000000000005',
      performance_score: 'NORMAL',
      potential_score: 'NORMAL',
      grid_cell: 'NORMAL_NORMAL',
      note: null,
      acting_reason: null,
      status: 'SUBMITTED',
      version: 2,
      updated_at: '2026-10-01T10:00:00Z',
    }
    const submittedWorkspace: ReviewWorkspace = {
      ...workspace,
      campaigns: workspace.campaigns.map((campaign) => ({ ...campaign, status: 'HR_REVIEW' })),
      assignments: workspace.assignments.map((assignment) => ({ ...assignment, status: 'SUBMITTED', submitted_at: '2026-10-01T10:00:00Z' })),
      scores: [submittedScore],
    }
    const { host, root } = mount(createElement(TalentReviewWorkspace, { initial: submittedWorkspace, labels, mode: 'manager' }))
    try {
      expect(host.querySelectorAll('[role="tab"]')).toHaveLength(1)
      expect(host.querySelector('[role="tab"]')?.textContent).toContain('reviewTab')
      const employee = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('First employee'))
      act(() => employee?.click())
      expect(host.querySelector<HTMLButtonElement>('button[aria-label="Performance"]')?.disabled).toBe(true)
      expect(Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('Save draft'))?.disabled).toBe(true)
    } finally {
      unmount(host, root)
    }
  })

  it('shows separate campaigns, review, and results tabs to HR', () => {
    const { host, root } = mount(createElement(TalentReviewWorkspace, { initial: workspace, initialTab: 'campaigns', labels, mode: 'hr' }))
    try {
      expect(Array.from(host.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent?.trim())).toEqual(['campaignsTab', 'reviewTab', 'resultsTab'])
    } finally {
      unmount(host, root)
    }
  })
})
