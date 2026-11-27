// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PerformanceReviewRoundDetail } from './performance-review-round-detail'

const labels = {
  rounds: 'Gespreksrondes', closeRound: 'Ronde sluiten', closeReason: 'Reden voor sluiten', close: 'Sluiten', closed: 'Gesloten',
  error: 'Fout', saved: 'Opgeslagen', status: 'Status', period: 'Periode', dueDate: 'Streefdatum', participants: 'Deelnemers',
  employee: 'Medewerker', selected: 'geselecteerd', add: 'Toevoegen', confirmClose: 'Doorgaan?', confirmCloseTitle: 'Ronde sluiten?',
  cancel: 'Annuleren', roundDraft: 'Concept', roundScheduled: 'Gepland', roundActive: 'Actief', roundClosed: 'Gesloten',
  roundCancelled: 'Geannuleerd', waitingEmployee: 'Wacht op medewerker', waitingAdditionalReviewer: 'Wacht op aanvullende beoordelaar', waitingManager: 'Wacht op manager',
  waitingAcknowledgement: 'Wacht op bevestiging', waitingReviewerClose: 'Wacht op afsluiting', completedAgreed: 'Afgerond met akkoord', completedDisagreed: 'Voor gezien, niet akkoord',
  phaseCancelled: 'Geannuleerd', additionalReviewerEnabled: 'Aanvullende beoordelaar ingeschakeld', additionalReviewer: 'Aanvullende beoordelaar',
  bulkFlip: 'Rollen omwisselen', flipAll: 'Alle deelnemers', flipFiltered: 'Gefilterde deelnemers', flipSelected: 'Geselecteerde deelnemers',
  previewFlip: 'Voorbeeld bekijken', applyFlip: 'Omwisseling uitvoeren', flipPreview: 'Voorbeeld van rolomwisseling', flipReason: 'Reden voor omwisseling',
  flipChanged: 'Omgewisseld', flipBlocked: 'Overgeslagen', flipDrafts: 'Concepten', preserveDrafts: 'Concepten bewaren',
  draftArchiveWarning: 'Concepten worden gearchiveerd.', closeConversation: 'Gesprek afsluiten', search: 'Zoeken', open: 'Open', swapRoles: 'Rollen omwisselen',
}

afterEach(() => vi.unstubAllGlobals())

describe('PerformanceReviewRoundDetail', () => {
  it('renders translated round and participant statuses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: 'round-1', title: 'Ontwikkelgesprek 2026', introduction: 'Terugkijken en vooruitkijken.', status: 'ACTIVE', version: 1,
      period_start: '2026-01-01', period_end: '2026-12-31', due_date: '2026-12-18',
      participants: [{ id: 'dossier-1', employeeName: 'Noah Hendriks', phase: 'WAITING_EMPLOYEE' }],
    }), { status: 200 })))
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => { root.render(createElement(PerformanceReviewRoundDetail, { roundId: 'round-1', labels })) })
    await act(async () => { await Promise.resolve() })
    expect(host.textContent).toContain('Actief')
    expect(host.textContent).toContain('Wacht op medewerker')
    expect(host.textContent).not.toContain('ACTIVE')
    expect(host.textContent).not.toContain('WAITING_EMPLOYEE')
    act(() => root.unmount())
    host.remove()
  })
})
