import { redirect } from 'next/navigation'
import { TeamCompassWorkspace } from '@/components/team-compass/team-compass-workspace'
import { getTeamCompassWorkspaceLabels } from '@/lib/team-compass/labels'
import { getTeamCompassWorkspace, TeamCompassServiceError } from '@/lib/team-compass/service'

export default async function TeamCompassSettingsPage() {
  let initial
  let labels
  try {
    ;[initial, labels] = await Promise.all([getTeamCompassWorkspace(), getTeamCompassWorkspaceLabels()])
    if (initial.mode !== 'admin') redirect('/geen-toegang')
  } catch (error) {
    if (error instanceof TeamCompassServiceError && [403, 404].includes(error.status)) redirect('/geen-toegang')
    throw error
  }
  return <TeamCompassWorkspace initial={initial} labels={labels} managementOnly />
}
