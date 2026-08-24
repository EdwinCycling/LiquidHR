export type JourneyStepStatus = 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'
export type JourneyTopicStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED'

export function isJourneyTopicActionAvailable(input: {
  journeyStatus: string
  topicStatus: string
  availableOn: string
  today: string
}): boolean {
  return input.journeyStatus === 'ACTIVE'
    && input.topicStatus === 'PENDING'
    && input.availableOn <= input.today
}

export function journeyProgressFromTopics(topics: readonly { status: string }[]): { completed: number; total: number } {
  return {
    completed: topics.filter((topic) => topic.status === 'COMPLETED').length,
    total: topics.length,
  }
}
