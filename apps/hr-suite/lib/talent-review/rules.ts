export const GRID_VALUES = ['LOW', 'NORMAL', 'HIGH'] as const
export type GridValue = (typeof GRID_VALUES)[number]

export type GridCell = `${GridValue}_${GridValue}`

export function canManagerAccessReviewSubject(managerEmployeeId: string, employeeId: string): boolean {
  return managerEmployeeId !== employeeId
}

export function deriveGridCell(performanceScore: GridValue | null, potentialScore: GridValue | null): GridCell | null {
  return performanceScore && potentialScore ? `${performanceScore}_${potentialScore}` : null
}

export function calculateCampaignReminderAt(startsOn: string, endsOn: string, now = new Date()): Date {
  const start = new Date(`${startsOn}T00:00:00.000Z`)
  const end = new Date(`${endsOn}T09:00:00.000Z`)
  const sevenDaysBeforeEnd = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
  const planned = sevenDaysBeforeEnd < start ? end : sevenDaysBeforeEnd
  return planned <= now ? new Date(now.getTime() + 60 * 1000) : planned
}

export function movementDirection(previousCell: GridCell | null, currentCell: GridCell | null): 'UP' | 'DOWN' | 'STABLE' | 'NEW' | 'UNKNOWN' {
  if (!currentCell) return 'UNKNOWN'
  if (!previousCell) return 'NEW'
  const [previousPerformance, previousPotential] = previousCell.split('_').map((value) => GRID_VALUES.indexOf(value as GridValue))
  const [currentPerformance, currentPotential] = currentCell.split('_').map((value) => GRID_VALUES.indexOf(value as GridValue))
  const previousTotal = previousPerformance + previousPotential
  const currentTotal = currentPerformance + currentPotential
  if (currentTotal > previousTotal) return 'UP'
  if (currentTotal < previousTotal) return 'DOWN'
  return 'STABLE'
}
