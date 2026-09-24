export type OrganizationChartPageSearchParams = Record<string, string | string[] | undefined>

interface OrganizationChartFilterState {
  view?: string
  date?: string
  q?: string
  department?: string
  role?: string
  field?: string
  value?: string
}

export function resolveOrganizationChartPageQuery(
  params: OrganizationChartPageSearchParams,
  storedFilter: OrganizationChartFilterState,
  defaultDate: string,
): OrganizationChartPageSearchParams {
  const hasExplicitQuery = Object.values(params).some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value)))
  if (hasExplicitQuery) return params

  const source: OrganizationChartPageSearchParams = {}
  Object.entries(storedFilter).forEach(([key, value]) => {
    if (typeof value === 'string' && value.length > 0) source[key] = value
  })
  source.date = defaultDate
  return source
}

export function hasOrganizationChartResultFilter(query: OrganizationChartFilterState): boolean {
  return Boolean(query.q?.trim() || query.department || query.role || (query.field && query.value?.trim()))
}
