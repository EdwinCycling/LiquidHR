export type EmploymentRegulationVersion = {
  id: string
  code: string
  name: string
  standardHoursPerWeek: number
  probationMaximumMonths: 1 | 2
  validFrom: string
  predecessorId: string | null
  isActive: boolean
}

export type EmploymentRegulationTimeline = {
  id: string
  name: string
  code: string
  versions: EmploymentRegulationVersion[]
}

export type EmploymentRegulationRow = {
  id: string
  code: string
  name: string
  standard_hours_per_week: number
  probation_maximum_months?: number | null
  valid_from: string
  predecessor_id: string | null
  is_active: boolean
}

export function buildEmploymentRegulationTimelines(rows: EmploymentRegulationRow[]): EmploymentRegulationTimeline[] {
  const versions = rows.map((row): EmploymentRegulationVersion => ({
    id: row.id,
    code: row.code,
    name: row.name,
    standardHoursPerWeek: Number(row.standard_hours_per_week),
    probationMaximumMonths: row.probation_maximum_months === 2 ? 2 : 1,
    validFrom: row.valid_from,
    predecessorId: row.predecessor_id,
    isActive: row.is_active,
  }))
  const byPredecessor = new Map<string, EmploymentRegulationVersion>()
  versions.forEach((version) => { if (version.predecessorId) byPredecessor.set(version.predecessorId, version) })
  const roots = versions.filter((version) => version.predecessorId === null)
  return roots.map((root) => {
    const chain: EmploymentRegulationVersion[] = []
    let current: EmploymentRegulationVersion | undefined = root
    while (current) {
      chain.push(current)
      current = byPredecessor.get(current.id)
    }
    return { id: root.id, name: root.name, code: root.code, versions: chain }
  })
}
