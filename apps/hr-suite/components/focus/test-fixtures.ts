import type { FocusHomeData } from '@/lib/focus/service'
import type { JourneyProjection } from '@/lib/journeys/projection-domain'

export const focusJourney: JourneyProjection = {
  id: '11111111-1111-4111-8111-111111111111',
  templateName: { nl: 'Een goede start', en: 'A good start' },
  status: 'ACTIVE', anchorDate: '2026-09-18', targetEmployeeName: 'Noah Test',
  relationship: 'SELF', progress: { completed: 1, total: 3 },
  participants: [], phases: [],
  nextAction: {
    id: '22222222-2222-4222-8222-222222222222', key: 'sign',
    title: { nl: 'Onderteken je document', en: 'Sign your document' }, body: {},
    topicType: 'DOCUMENT', isRequired: true, status: 'PENDING',
    actionUrl: '/my-signatures', ownerRoleKey: 'employee',
    momentId: '33333333-3333-4333-8333-333333333333', momentName: { nl: 'Welkom', en: 'Welcome' },
    scheduledOn: '2026-09-17', availableOn: '2026-09-17', availability: 'AVAILABLE',
  },
}

export function focusData(overrides: Partial<FocusHomeData> = {}): FocusHomeData {
  return {
    experience: 'EMPLOYEE', presentation: 'FOCUS',
    employee: { id: '44444444-4444-4444-8444-444444444444', name: 'Noah Test', avatarUrl: null, effectiveEmploymentStartDate: '2026-09-17' },
    journey: focusJourney,
    actions: [
      { key: 'journey', href: '/focus/onboarding' },
      { key: 'profile', href: '/focus/profiel' },
      { key: 'documents', href: '/focus/documenten' },
      { key: 'leave', href: '/employees/44444444-4444-4444-8444-444444444444/leave' },
      { key: 'hours', href: '/focus/uren' },
      { key: 'requests', href: '/focus/aanvragen' },
      { key: 'work', href: '/focus/werk' },
      { key: 'team', href: '/focus/team' },
      { key: 'absence', href: '/focus/ziek' },
    ],
    isPreboarding: false, isEssBlocked: false, readOnly: false, isPreview: false, canOpenFull: true, canRequestLeave: true, canReportAbsence: true, canReportEmployeeAbsence: false, managerHome: null, actAs: null,
    ...overrides,
  }
}
