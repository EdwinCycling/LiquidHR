// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { FocusAbsenceForm, type FocusAbsenceFormLabels } from './focus-absence-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const labels: FocusAbsenceFormLabels = {
  title: 'Ziek melden', description: 'Meld je eerste ziektedag.', startDate: 'Vanaf wanneer ben je ziek?', submit: 'Ziekmelding versturen', submitting: 'Versturen…', success: 'Verstuurd', failed: 'Mislukt', expectedRecoveryOn: 'Wanneer verwacht je weer te kunnen werken?', optional: 'optioneel',
  recoveryTitle: 'Ik ben hersteld', recoveryDescription: 'Meld herstel.', recoveryDate: 'Hersteld vanaf', recoverySubmit: 'Herstel melden', recoverySubmitting: 'Versturen…', recoverySuccess: 'Verwerkt', recoveryFailed: 'Mislukt',
}

describe('Focus absence forms', () => {
  it('keeps employee Focus date-only without a medical explanation field', () => {
    const markup = renderToStaticMarkup(<FocusAbsenceForm employeeId="11111111-1111-4111-8111-111111111111" employmentId="22222222-2222-4222-222222222222" showExpectedRecoveryOn={false} today="2026-09-19" labels={labels} />)

    expect(markup).not.toContain('Wanneer verwacht je weer te kunnen werken?')
    expect(markup).not.toContain('optioneel')
    expect(markup).not.toContain('<textarea')
    expect(markup).not.toContain('diagnose')
  })

  it('keeps the recovery form reusable for manager flows', () => {
    const markup = renderToStaticMarkup(<FocusAbsenceForm employeeId="11111111-1111-4111-8111-111111111111" recoveryCaseId="33333333-3333-4333-8333-333333333333" mode="recovery" today="2026-09-19" labels={labels} />)

    expect(markup).toContain('Ik ben hersteld')
    expect(markup).toContain('Herstel melden')
    expect(markup).not.toContain('Ziekmelding versturen')
  })
})
