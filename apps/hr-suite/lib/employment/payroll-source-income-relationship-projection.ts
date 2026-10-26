export type PayrollSourceIncomeRelationshipRow = {
  readonly id: string
  readonly incomeRelationshipId: string
  readonly validFrom: string
  readonly validUntil: string | null
  readonly linkUpdatedAt: string
  readonly reportingStatus: 'DRAFT' | 'READY' | 'REPORTED' | 'CLOSED'
  readonly startsOn: string
  readonly endsOn: string | null
  readonly incomeRelationshipUpdatedAt: string
}

type EmploymentIncomeRelationshipLink = {
  readonly id: string
  readonly employment_id: string
  readonly income_relationship_id: string
  readonly valid_from: string
  readonly valid_until: string | null
  readonly updated_at: string
}

type IncomeRelationship = {
  readonly id: string
  readonly reporting_status: PayrollSourceIncomeRelationshipRow['reportingStatus']
  readonly starts_on: string
  readonly ends_on: string | null
  readonly updated_at: string
}

/** Reuses tax-source reads only when they can reproduce the target-employment join without truncation. */
export function buildPayrollSourceIncomeRelationshipProjection(input: {
  readonly employmentId: string
  readonly complete: boolean
  readonly links: readonly EmploymentIncomeRelationshipLink[]
  readonly incomeRelationships: readonly IncomeRelationship[]
}): { readonly complete: boolean; readonly rows: readonly PayrollSourceIncomeRelationshipRow[] } {
  if (!input.complete) return { complete: false, rows: [] }

  const incomeById = new Map(input.incomeRelationships.map((income) => [income.id, income]))
  const targetLinks = input.links.filter((link) => link.employment_id === input.employmentId)
  const rows: PayrollSourceIncomeRelationshipRow[] = []
  for (const link of targetLinks) {
    const income = incomeById.get(link.income_relationship_id)
    if (!income) return { complete: false, rows: [] }
    rows.push({
      id: link.id,
      incomeRelationshipId: income.id,
      validFrom: link.valid_from,
      validUntil: link.valid_until,
      linkUpdatedAt: link.updated_at,
      reportingStatus: income.reporting_status,
      startsOn: income.starts_on,
      endsOn: income.ends_on,
      incomeRelationshipUpdatedAt: income.updated_at,
    })
  }

  rows.sort((left, right) => left.validFrom.localeCompare(right.validFrom) || left.id.localeCompare(right.id))
  return { complete: true, rows }
}
