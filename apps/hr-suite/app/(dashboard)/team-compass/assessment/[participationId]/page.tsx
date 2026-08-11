import { redirect } from 'next/navigation'
import { TeamCompassAssessment } from '@/components/team-compass/team-compass-assessment'
import { getLocale } from '@/lib/i18n/server'
import { getTeamCompassAssessmentLabels } from '@/lib/team-compass/labels'
import { getTeamCompassAssessment, TeamCompassServiceError } from '@/lib/team-compass/service'

export default async function TeamCompassAssessmentPage({ params }: { params: Promise<{ participationId: string }> }) {
  const { participationId } = await params
  let initial
  let labels
  let locale
  try {
    ;[initial, labels, locale] = await Promise.all([getTeamCompassAssessment(participationId), getTeamCompassAssessmentLabels(), getLocale()])
    if (initial.profile || initial.participation.status === 'COMPLETED') redirect(`/team-compass/results/${participationId}`)
  } catch (error) {
    if (error instanceof TeamCompassServiceError && [403, 404].includes(error.status)) redirect('/geen-toegang')
    throw error
  }
  return <TeamCompassAssessment initial={initial} labels={labels} locale={locale} />
}
