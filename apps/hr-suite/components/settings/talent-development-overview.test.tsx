import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import type { StarPerformersInsights } from '@/lib/star-performers/insights-service'
import { TalentDevelopmentOverview } from './talent-development-overview'

it('renders counts from the current report data and distinguishes unavailable sources', () => {
  const data = {
    development: { sources: { plans: true }, activePlansCount: 2, averageProgress: 40 },
    skillGaps: { state: 'ready', assessedEmployees: 1, rows: [{ statusCounts: { NOT_ASSESSED: 3, EXPIRED_EVIDENCE: 1 } }] },
    appraisal: { sources: { items: false }, noConversationEmployees: 0, overdueFollowUpCount: 0 },
  } as unknown as StarPerformersInsights
  const labels = Object.fromEntries(['title','description','plans','activePlans','averageProgress','unavailable','openPlans','skills','noSkills','assessed','notAssessed','expiredEvidence','openSkills','conversations','noConversation','overdueFollowUp','openConversations','limits'].map(key => [key, key]))
  const html = renderToStaticMarkup(<TalentDevelopmentOverview data={data} labels={labels} />)
  expect(html).toMatch(/activePlans:[\s\S]*?2/)
  expect(html).toMatch(/notAssessed:[\s\S]*?3/)
  expect(html).toContain('unavailable')
  const updated = renderToStaticMarkup(<TalentDevelopmentOverview data={{ ...data, development: { ...data.development, activePlansCount: 1 } }} labels={labels} />)
  expect(updated).toMatch(/activePlans:[\s\S]*?1/)
})
