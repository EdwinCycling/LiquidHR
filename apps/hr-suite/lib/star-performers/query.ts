import type { StarPerformerWorkspaceQuery } from './schemas'

export function starPerformersQueryString(query: StarPerformerWorkspaceQuery): string {
  const params = new URLSearchParams()
  params.set('perspective', query.perspective)
  params.set('area', query.area)
  params.set('insight', query.insight)
  if (query.q) params.set('q', query.q)
  if (query.departmentId) params.set('departmentId', query.departmentId)
  if (query.jobId) params.set('jobId', query.jobId)
  if (query.jobGroupId) params.set('jobGroupId', query.jobGroupId)
  if (query.period) params.set('period', query.period)
  if (query.periodFrom) params.set('periodFrom', query.periodFrom)
  if (query.periodTo) params.set('periodTo', query.periodTo)
  if (query.appraisalStatus !== 'all') params.set('appraisalStatus', query.appraisalStatus)
  if (query.status !== 'all') params.set('status', query.status)
  params.set('page', String(query.page))
  params.set('pageSize', String(query.pageSize))
  return params.toString()
}
