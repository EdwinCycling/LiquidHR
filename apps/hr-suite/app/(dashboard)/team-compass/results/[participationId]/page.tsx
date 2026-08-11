import { redirect } from 'next/navigation'
import { TeamCompassResult } from '@/components/team-compass/team-compass-result'
import { getTeamCompassResultLabels } from '@/lib/team-compass/labels'
import { getTeamCompassAssessment, TeamCompassServiceError } from '@/lib/team-compass/service'

export default async function TeamCompassResultPage({ params }: { params: Promise<{ participationId: string }> }) {
  const { participationId } = await params
  let initial
  let labels
  try {
    ;[initial, labels] = await Promise.all([getTeamCompassAssessment(participationId), getTeamCompassResultLabels()])
    if (!initial.profile) redirect(`/team-compass/assessment/${participationId}`)
  } catch (error) {
    if (error instanceof TeamCompassServiceError && [403, 404].includes(error.status)) redirect('/geen-toegang')
    throw error
  }
  return <TeamCompassResult initial={initial} labels={labels} />
}
