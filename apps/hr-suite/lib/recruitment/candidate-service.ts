import type { Database } from '@scope/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { AuthContext } from '@/lib/auth/permissions'
import { recruitmentGuidSchema } from './domain'
import { recruitmentDatabaseError, RecruitmentError } from './errors'

export const candidateIndexStateSchema = z.enum(['ALL', 'ACTIVE', 'AANGENOMEN', 'AFGEWEZEN'])
export const candidateIndexSortSchema = z.enum(['RECENT', 'NAME'])

export type CandidateIndexState = z.infer<typeof candidateIndexStateSchema>
export type CandidateIndexSort = z.infer<typeof candidateIndexSortSchema>

export interface CandidateIndexQuery {
  readonly search: string
  readonly state: CandidateIndexState
  readonly vacancyId: string
  readonly stageId: string
  readonly sort: CandidateIndexSort
  readonly page: number
}

export interface CandidateIndexCandidateRecord {
  readonly id: string
  readonly firstName: string
  readonly lastName: string
  readonly privateEmail: string | null
  readonly phone: string | null
  readonly possibleDuplicate: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CandidateIndexApplicationRecord {
  readonly id: string
  readonly candidateId: string
  readonly vacancyId: string
  readonly activeStageId: string | null
  readonly terminalOutcome: 'AFGEWEZEN' | 'AANGENOMEN' | null
  readonly source: 'MANUAL' | 'PUBLIC'
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CandidateIndexVacancyOption {
  readonly id: string
  readonly title: string
}

export interface CandidateIndexStageOption {
  readonly id: string
  readonly name: string
  readonly sortOrder: number
}

export interface CandidateIndexApplication {
  readonly id: string
  readonly vacancyId: string
  readonly vacancyTitle: string
  readonly stageId: string | null
  readonly stageName: string | null
  readonly state: Exclude<CandidateIndexState, 'ALL'>
  readonly source: 'MANUAL' | 'PUBLIC'
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CandidateIndexRow {
  readonly id: string
  readonly name: string
  readonly privateEmail: string | null
  readonly phone: string | null
  readonly possibleDuplicate: boolean
  readonly updatedAt: string
  readonly applicationCount: number
  readonly applications: readonly CandidateIndexApplication[]
}

export interface CandidateIndexSourceData {
  readonly candidates: readonly CandidateIndexCandidateRecord[]
  readonly applications: readonly CandidateIndexApplicationRecord[]
  readonly vacancies: readonly CandidateIndexVacancyOption[]
  readonly stages: readonly CandidateIndexStageOption[]
}

export interface CandidateIndexData {
  readonly rows: readonly CandidateIndexRow[]
  readonly totalResults: number
  readonly totalPages: number
  readonly page: number
  readonly pageSize: number
  readonly vacancies: readonly CandidateIndexVacancyOption[]
  readonly stages: readonly CandidateIndexStageOption[]
}

export const CANDIDATE_INDEX_PAGE_SIZE = 20

const candidateRowSchema = z.object({
  id: recruitmentGuidSchema,
  first_name: z.string(),
  last_name: z.string(),
  private_email: z.string().nullable(),
  phone: z.string().nullable(),
  possible_duplicate: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

const applicationRowSchema = z.object({
  id: recruitmentGuidSchema,
  candidate_id: recruitmentGuidSchema,
  vacancy_id: recruitmentGuidSchema,
  active_stage_id: recruitmentGuidSchema.nullable(),
  terminal_outcome: z.enum(['AFGEWEZEN', 'AANGENOMEN']).nullable(),
  source: z.enum(['MANUAL', 'PUBLIC']),
  created_at: z.string(),
  updated_at: z.string(),
})

const vacancyRowSchema = z.object({ id: recruitmentGuidSchema, title: z.string() })
const stageRowSchema = z.object({ id: recruitmentGuidSchema, name: z.string(), sort_order: z.number().int() })

function enumValue<T extends string>(schema: z.ZodEnum<Record<T, T>>, value: string | null, fallback: T): T {
  const parsed = schema.safeParse(value)
  return parsed.success ? parsed.data : fallback
}

function scopedId(value: string | null): string {
  if (!value || value === 'ALL') return 'ALL'
  return recruitmentGuidSchema.safeParse(value).success ? value : 'ALL'
}

export function parseCandidateIndexQuery(params: URLSearchParams): CandidateIndexQuery {
  const rawPage = Number.parseInt(params.get('page') ?? '1', 10)
  return {
    search: (params.get('q') ?? '').trim().slice(0, 120),
    state: enumValue(candidateIndexStateSchema, params.get('state'), 'ALL'),
    vacancyId: scopedId(params.get('vacancy')),
    stageId: scopedId(params.get('stage')),
    sort: enumValue(candidateIndexSortSchema, params.get('sort'), 'RECENT'),
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  }
}

export function candidateIndexQueryParams(query: CandidateIndexQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.search) params.set('q', query.search)
  if (query.state !== 'ALL') params.set('state', query.state)
  if (query.vacancyId !== 'ALL') params.set('vacancy', query.vacancyId)
  if (query.stageId !== 'ALL') params.set('stage', query.stageId)
  if (query.sort !== 'RECENT') params.set('sort', query.sort)
  if (query.page > 1) params.set('page', String(query.page))
  return params
}

function applicationState(application: CandidateIndexApplicationRecord): Exclude<CandidateIndexState, 'ALL'> {
  return application.terminalOutcome ?? 'ACTIVE'
}

function includesSearch(value: string | null | undefined, normalizedSearch: string): boolean {
  return Boolean(value?.toLocaleLowerCase().includes(normalizedSearch))
}

function compareByRecent(left: CandidateIndexRow, right: CandidateIndexRow): number {
  return right.applications[0]?.updatedAt.localeCompare(left.applications[0]?.updatedAt ?? right.updatedAt)
    || right.updatedAt.localeCompare(left.updatedAt)
    || left.name.localeCompare(right.name, 'nl', { sensitivity: 'base' })
}

function compareByName(left: CandidateIndexRow, right: CandidateIndexRow): number {
  return left.name.localeCompare(right.name, 'nl', { sensitivity: 'base' })
    || right.updatedAt.localeCompare(left.updatedAt)
}

export function buildCandidateIndexRows(source: CandidateIndexSourceData, query: CandidateIndexQuery): readonly CandidateIndexRow[] {
  const vacancyById = new Map(source.vacancies.map((vacancy) => [vacancy.id, vacancy]))
  const stageById = new Map(source.stages.map((stage) => [stage.id, stage]))
  const applicationsByCandidate = new Map<string, CandidateIndexApplicationRecord[]>()

  for (const application of source.applications) {
    const current = applicationsByCandidate.get(application.candidateId) ?? []
    current.push(application)
    applicationsByCandidate.set(application.candidateId, current)
  }

  const normalizedSearch = query.search.toLocaleLowerCase()
  const hasApplicationFilter = query.state !== 'ALL' || query.vacancyId !== 'ALL' || query.stageId !== 'ALL'
  const rows = source.candidates.flatMap((candidate) => {
    const applications = applicationsByCandidate.get(candidate.id) ?? []
    const mappedApplications = applications.flatMap((application): CandidateIndexApplication[] => {
      const vacancy = vacancyById.get(application.vacancyId)
      if (!vacancy) return []
      const stage = application.activeStageId ? stageById.get(application.activeStageId) : undefined
      return [{
        id: application.id,
        vacancyId: application.vacancyId,
        vacancyTitle: vacancy.title,
        stageId: application.activeStageId,
        stageName: stage?.name ?? null,
        state: applicationState(application),
        source: application.source,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
      }]
    }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

    const candidateTextMatches = [candidate.firstName, candidate.lastName, candidate.privateEmail, candidate.phone]
      .some((value) => includesSearch(value, normalizedSearch))
    const applicationTextMatches = mappedApplications.some((application) => [application.vacancyTitle, application.stageName]
      .some((value) => includesSearch(value, normalizedSearch)))
    const filteredApplications = mappedApplications.filter((application) =>
      (query.state === 'ALL' || application.state === query.state)
      && (query.vacancyId === 'ALL' || application.vacancyId === query.vacancyId)
      && (query.stageId === 'ALL' || application.stageId === query.stageId),
    )

    if (normalizedSearch && !candidateTextMatches && !applicationTextMatches) return []
    if (hasApplicationFilter && filteredApplications.length === 0) return []

    return [{
      id: candidate.id,
      name: `${candidate.firstName} ${candidate.lastName}`,
      privateEmail: candidate.privateEmail,
      phone: candidate.phone,
      possibleDuplicate: candidate.possibleDuplicate,
      updatedAt: candidate.updatedAt,
      applicationCount: mappedApplications.length,
      applications: hasApplicationFilter ? filteredApplications : mappedApplications,
    }]
  })

  return rows.sort(query.sort === 'NAME' ? compareByName : compareByRecent)
}

type SupabaseServerClient = SupabaseClient<Database>

export async function listRecruitmentCandidateIndex(
  context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>,
  query: CandidateIndexQuery,
  supabase: SupabaseServerClient,
): Promise<CandidateIndexData> {
  if (!context.hrGroupId) throw new RecruitmentError('RECRUITMENT_HR_GROUP_REQUIRED', 403)

  const [candidateResult, applicationResult, vacancyResult, stageResult] = await Promise.all([
    supabase.from('recruitment_candidates')
      .select('id,first_name,last_name,private_email,phone,possible_duplicate,created_at,updated_at')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId)
      .order('last_name', { ascending: true }).order('first_name', { ascending: true }).limit(1000),
    supabase.from('recruitment_applications')
      .select('id,candidate_id,vacancy_id,active_stage_id,terminal_outcome,source,created_at,updated_at')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId)
      .order('updated_at', { ascending: false }).limit(2000),
    supabase.from('recruitment_vacancies')
      .select('id,title').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId)
      .order('title', { ascending: true }).limit(500),
    supabase.from('recruitment_pipeline_stages')
      .select('id,name,sort_order').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId)
      .order('sort_order', { ascending: true }).limit(100),
  ])

  for (const result of [candidateResult, applicationResult, vacancyResult, stageResult]) {
    if (result.error) throw recruitmentDatabaseError(result.error)
  }

  const candidates = (candidateResult.data ?? []).map((row) => {
    const parsed = candidateRowSchema.parse(row)
    return {
      id: parsed.id, firstName: parsed.first_name, lastName: parsed.last_name,
      privateEmail: parsed.private_email, phone: parsed.phone, possibleDuplicate: parsed.possible_duplicate,
      createdAt: parsed.created_at, updatedAt: parsed.updated_at,
    }
  })
  const applications = (applicationResult.data ?? []).map((row) => {
    const parsed = applicationRowSchema.parse(row)
    return {
      id: parsed.id, candidateId: parsed.candidate_id, vacancyId: parsed.vacancy_id,
      activeStageId: parsed.active_stage_id, terminalOutcome: parsed.terminal_outcome, source: parsed.source,
      createdAt: parsed.created_at, updatedAt: parsed.updated_at,
    }
  })
  const vacancies = (vacancyResult.data ?? []).map((row) => {
    const parsed = vacancyRowSchema.parse(row)
    return { id: parsed.id, title: parsed.title }
  })
  const stages = (stageResult.data ?? []).map((row) => {
    const parsed = stageRowSchema.parse(row)
    return { id: parsed.id, name: parsed.name, sortOrder: parsed.sort_order }
  })

  const allRows = buildCandidateIndexRows({ candidates, applications, vacancies, stages }, query)
  const totalPages = Math.ceil(allRows.length / CANDIDATE_INDEX_PAGE_SIZE)
  const page = totalPages === 0 ? 1 : Math.min(query.page, totalPages)
  const start = (page - 1) * CANDIDATE_INDEX_PAGE_SIZE

  return {
    rows: allRows.slice(start, start + CANDIDATE_INDEX_PAGE_SIZE),
    totalResults: allRows.length,
    totalPages,
    page,
    pageSize: CANDIDATE_INDEX_PAGE_SIZE,
    vacancies,
    stages,
  }
}
