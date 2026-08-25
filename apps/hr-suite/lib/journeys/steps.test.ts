import { describe, expect, it } from 'vitest'
import { isJourneyTopicActionAvailable, journeyProgressFromTopics } from './steps'

describe('Journey steps runtime contract', () => {
  it('only exposes topic outcomes for an active, pending, available topic', () => {
    const base = { journeyStatus: 'ACTIVE', topicStatus: 'PENDING', availableOn: '2026-08-24', today: '2026-08-24' }
    expect(isJourneyTopicActionAvailable(base)).toBe(true)
    expect(isJourneyTopicActionAvailable({ ...base, availableOn: '2026-08-25' })).toBe(false)
    expect(isJourneyTopicActionAvailable({ ...base, journeyStatus: 'PAUSED' })).toBe(false)
    expect(isJourneyTopicActionAvailable({ ...base, topicStatus: 'COMPLETED' })).toBe(false)
    expect(isJourneyTopicActionAvailable({ ...base, journeyStatus: 'COMPLETED' })).toBe(false)
    expect(isJourneyTopicActionAvailable({ ...base, journeyStatus: 'CANCELLED' })).toBe(false)
  })

  it('counts only completed topics in the visible projection', () => {
    expect(journeyProgressFromTopics([{ status: 'COMPLETED' }, { status: 'PENDING' }, { status: 'SKIPPED' }])).toEqual({ completed: 1, total: 3 })
    expect(journeyProgressFromTopics([])).toEqual({ completed: 0, total: 0 })
  })
})
