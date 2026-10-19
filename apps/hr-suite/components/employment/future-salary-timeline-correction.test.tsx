// @vitest-environment happy-dom

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { FutureSalaryTimelineCorrection } from './future-salary-timeline-correction'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const labels = {
  button: 'Toekomstige salarisregel corrigeren',
  title: 'Toekomstige salarisregel terugdraaien?',
  description: 'Alleen de laatste salarisregel vanaf {date} wordt teruggedraaid.',
  reason: 'Reden van correctie',
  confirm: 'Salarisregel terugdraaien',
  cancel: 'Annuleren',
  saving: 'Bezig met terugdraaien…',
  saved: 'Salarisregel teruggedraaid.',
  failed: 'Controleer de actuele tijdlijn.',
}

function markup(overrides: Partial<Parameters<typeof FutureSalaryTimelineCorrection>[0]> = {}) {
  return renderToStaticMarkup(createElement(FutureSalaryTimelineCorrection, {
    employmentId: 'employment-1',
    effectiveOn: '2026-11-01',
    today: '2026-10-19',
    periodCount: 2,
    canWrite: true,
    labels,
    ...overrides,
  }))
}

describe('future salary timeline correction', () => {
  it('shows the correction action only for a writable future salary period with a predecessor', () => {
    expect(markup()).toContain('Toekomstige salarisregel corrigeren')
    expect(markup({ canWrite: false })).not.toContain('Toekomstige salarisregel corrigeren')
    expect(markup({ periodCount: 1 })).not.toContain('Toekomstige salarisregel corrigeren')
    expect(markup({ effectiveOn: '2026-10-01' })).not.toContain('Toekomstige salarisregel corrigeren')
  })

})
