import { createPersonalReminder } from '@/lib/reminders/reminder-service'

export interface RecruitmentReminderInput {
  readonly applicationId: string
  readonly title: string
  readonly description: string
  readonly remindAt: string
}

export function recruitmentApplicationUrl(applicationId: string): string {
  return `/recruitment/applications/${applicationId}`
}

export async function createRecruitmentFollowUpReminder(
  input: RecruitmentReminderInput,
  createReminder: typeof createPersonalReminder = createPersonalReminder,
): Promise<string> {
  return createReminder({
    title: input.title,
    description: `${input.description} ${recruitmentApplicationUrl(input.applicationId)}`,
    remindAt: input.remindAt,
  })
}
