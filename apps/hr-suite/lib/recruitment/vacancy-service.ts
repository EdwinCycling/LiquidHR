import type { Database, Json } from '@scope/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { recruitmentGuidSchema } from './domain'
import { recruitmentDatabaseError, RecruitmentError } from './errors'

const sectionTypes = ['INTRODUCTION', 'ROLE', 'PROFILE', 'OFFER', 'PROCESS', 'CONTACT'] as const
export type VacancySectionType = typeof sectionTypes[number]
export type VacancyStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED'
const publicationStatuses = ['OPEN', 'CLOSED', 'ARCHIVED'] as const
export type PublicationStatus = typeof publicationStatuses[number]
const publicationFieldValues = ['HIDDEN', 'OPTIONAL', 'REQUIRED'] as const

const vacancySectionSchema = z.object({
  sectionType: z.enum(sectionTypes),
  title: z.string().trim().min(1).max(180),
  content: z.string().max(20_000),
  sortOrder: z.number().int().min(0).max(5),
  isVisible: z.boolean(),
}).strict()

export const publicationPayloadSchema = z.object({
  companyName: z.string().trim().min(1).max(120),
  sections: z.array(vacancySectionSchema).length(6),
  formConfig: z.object({
    phone: z.enum(publicationFieldValues),
    cv: z.enum(publicationFieldValues),
    motivation: z.enum(publicationFieldValues),
  }).strict(),
}).strict()

export const publicationRequestSchema = z.object({
  status: z.enum(publicationStatuses),
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).nullable().optional(),
  payload: publicationPayloadSchema,
}).strict().superRefine((value, context) => {
  if (value.status === 'OPEN' && !value.slug) context.addIssue({ code: 'custom', path: ['slug'], message: 'RECRUITMENT_PUBLICATION_SLUG_INVALID' })
})

export type PublicationPayload = z.infer<typeof publicationPayloadSchema>

export const vacancyInputSchema = z.object({
  title: z.string().trim().min(1).max(180),
  jobId: recruitmentGuidSchema.nullish(),
  locationLabel: z.string().trim().max(160).default(''),
  workMode: z.enum(['ON_SITE', 'HYBRID', 'REMOTE']).nullable().default(null),
  minHours: z.number().min(0).max(168).nullable().default(null),
  maxHours: z.number().min(0).max(168).nullable().default(null),
  salaryMin: z.number().min(0).nullable().default(null),
  salaryMax: z.number().min(0).nullable().default(null),
  salaryVisible: z.boolean().default(false),
  sections: z.array(vacancySectionSchema).length(6),
}).strict().superRefine((value, context) => {
  if (value.minHours !== null && value.maxHours !== null && value.minHours > value.maxHours) context.addIssue({ code: 'custom', path: ['maxHours'], message: 'VACANCY_HOURS_INVALID' })
  if (value.salaryMin !== null && value.salaryMax !== null && value.salaryMin > value.salaryMax) context.addIssue({ code: 'custom', path: ['salaryMax'], message: 'VACANCY_SALARY_INVALID' })
  if (new Set(value.sections.map((section) => section.sectionType)).size !== 6) context.addIssue({ code: 'custom', path: ['sections'], message: 'VACANCY_SECTIONS_INVALID' })
})

export type VacancyInput = z.infer<typeof vacancyInputSchema>

export interface VacancySummary {
  readonly id: string
  readonly title: string
  readonly locationLabel: string | null
  readonly workMode: 'ON_SITE' | 'HYBRID' | 'REMOTE' | null
  readonly status: VacancyStatus
  readonly updatedAt: string
  readonly version: number
  readonly applicationCount: number
  readonly activeApplicationCount: number
  readonly publication: { readonly id: string; readonly slug: string; readonly status: 'OPEN' | 'CLOSED' | 'ARCHIVED'; readonly payload: Record<string, unknown> } | null
}

export interface VacancyDetail extends VacancySummary {
  readonly jobId: string | null
  readonly minHours: number | null
  readonly maxHours: number | null
  readonly salaryMin: number | null
  readonly salaryMax: number | null
  readonly salaryVisible: boolean
  readonly sections: VacancyInput['sections']
}

export const VACANCY_LIST_PAGE_SIZE = 10

export const VACANCY_LIST_STATUSES = ['ALL', 'DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'] as const
export type VacancyListStatus = typeof VACANCY_LIST_STATUSES[number]

export const VACANCY_LIST_PUBLICATIONS = ['ALL', 'UNPUBLISHED', 'OPEN', 'CLOSED', 'ARCHIVED'] as const
export type VacancyListPublication = typeof VACANCY_LIST_PUBLICATIONS[number]

export const VACANCY_LIST_SORTS = ['UPDATED_DESC', 'TITLE_ASC', 'APPLICATIONS_DESC'] as const
export type VacancyListSort = typeof VACANCY_LIST_SORTS[number]

export interface RecruitmentVacancyListQuery {
  readonly q: string
  readonly status: VacancyListStatus
  readonly publication: VacancyListPublication
  readonly sort: VacancyListSort
  readonly page: number
}

export interface RecruitmentVacancyListResult {
  readonly items: VacancySummary[]
  readonly total: number
  readonly page: number
  readonly pageCount: number
}

type SupabaseServerClient = SupabaseClient<Database>
type RpcClient = SupabaseServerClient & {
  rpc(name: string, args: Record<string, unknown>): Promise<{ readonly data: unknown; readonly error: { readonly message: string } | null }>
}

const vacancyRowSchema = z.object({
  id: recruitmentGuidSchema,
  title: z.string(),
  job_id: recruitmentGuidSchema.nullable(),
  location_label: z.string().nullable(),
  work_mode: z.enum(['ON_SITE', 'HYBRID', 'REMOTE']).nullable(),
  min_hours: z.number().nullable(),
  max_hours: z.number().nullable(),
  salary_min: z.number().nullable(),
  salary_max: z.number().nullable(),
  salary_visible: z.boolean(),
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED']),
  version: z.number().int().positive(),
  updated_at: z.string(),
})

const sectionRowSchema = z.object({
  section_type: z.enum(sectionTypes),
  title: z.string(),
  content: z.string(),
  sort_order: z.number().int(),
  is_visible: z.boolean(),
})

const publicationRowSchema = z.object({
  id: recruitmentGuidSchema,
  slug: z.string(),
  status: z.enum(['OPEN', 'CLOSED', 'ARCHIVED']),
  published_payload: z.record(z.string(), z.unknown()).default({}),
})

export function buildDefaultVacancySections(): VacancyInput['sections'] {
  return [
    { sectionType: 'INTRODUCTION', title: 'Over de functie', sortOrder: 0, isVisible: true, content: '' },
    { sectionType: 'ROLE', title: 'Jouw rol', sortOrder: 1, isVisible: true, content: '' },
    { sectionType: 'PROFILE', title: 'Wat breng je mee?', sortOrder: 2, isVisible: true, content: '' },
    { sectionType: 'OFFER', title: 'Wat bieden wij?', sortOrder: 3, isVisible: true, content: '' },
    { sectionType: 'PROCESS', title: 'Sollicitatieprocedure', sortOrder: 4, isVisible: true, content: '' },
    { sectionType: 'CONTACT', title: 'Aanvullende informatie', sortOrder: 5, isVisible: true, content: '' },
  ]
}

export function createVacancySlug(value: string): string {
  const slug = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160)
  return slug || 'vacature'
}

export function canUpdateRecruitmentPublication(vacancyStatus: VacancyStatus, requestedStatus: PublicationStatus): boolean {
  if (vacancyStatus === 'ARCHIVED') return requestedStatus === 'ARCHIVED'
  return true
}

function toJsonSections(sections: VacancyInput['sections']): Json[] {
  return sections.map((section) => ({
    section_type: section.sectionType,
    title: section.title,
    content: section.content,
    sort_order: section.sortOrder,
    is_visible: section.isVisible,
  }))
}

function rpc(supabase: SupabaseServerClient): RpcClient {
  return supabase as unknown as RpcClient
}

function firstQueryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function parsePositivePage(value: string): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function queryEnum<T extends readonly string[]>(value: string, options: T, fallback: T[number]): T[number] {
  return (options as readonly string[]).includes(value) ? value as T[number] : fallback
}

export function parseRecruitmentVacancyListQuery(input: Record<string, string | string[] | undefined>): RecruitmentVacancyListQuery {
  return {
    q: firstQueryValue(input.q).trim(),
    status: queryEnum(firstQueryValue(input.status), VACANCY_LIST_STATUSES, 'ALL'),
    publication: queryEnum(firstQueryValue(input.publication), VACANCY_LIST_PUBLICATIONS, 'ALL'),
    sort: queryEnum(firstQueryValue(input.sort), VACANCY_LIST_SORTS, 'UPDATED_DESC'),
    page: parsePositivePage(firstQueryValue(input.page)),
  }
}

function publicationFilterValue(vacancy: VacancySummary): VacancyListPublication {
  return vacancy.publication?.status ?? 'UNPUBLISHED'
}

export function filterAndSortRecruitmentVacancies(vacancies: readonly VacancySummary[], query: Pick<RecruitmentVacancyListQuery, 'q' | 'status' | 'publication' | 'sort'>): VacancySummary[] {
  const normalizedQuery = query.q.toLocaleLowerCase('nl-NL')
  const filtered = vacancies.filter((vacancy) => {
    const searchable = `${vacancy.title} ${vacancy.locationLabel ?? ''}`.toLocaleLowerCase('nl-NL')
    return (query.status === 'ALL' || vacancy.status === query.status)
      && (query.publication === 'ALL' || publicationFilterValue(vacancy) === query.publication)
      && (!normalizedQuery || searchable.includes(normalizedQuery))
  })
  const collator = new Intl.Collator('nl', { sensitivity: 'base' })
  return [...filtered].sort((left, right) => {
    if (query.sort === 'TITLE_ASC') {
      const titleComparison = collator.compare(left.title, right.title)
      return titleComparison !== 0 ? titleComparison : right.updatedAt.localeCompare(left.updatedAt)
    }
    if (query.sort === 'APPLICATIONS_DESC') {
      const applicationComparison = right.activeApplicationCount - left.activeApplicationCount
      if (applicationComparison !== 0) return applicationComparison
      return right.updatedAt.localeCompare(left.updatedAt)
    }
    const updatedComparison = right.updatedAt.localeCompare(left.updatedAt)
    return updatedComparison !== 0 ? updatedComparison : collator.compare(left.title, right.title)
  })
}

export function paginateRecruitmentVacancies(vacancies: readonly VacancySummary[], query: RecruitmentVacancyListQuery): RecruitmentVacancyListResult {
  const filtered = filterAndSortRecruitmentVacancies(vacancies, query)
  const pageCount = Math.max(1, Math.ceil(filtered.length / VACANCY_LIST_PAGE_SIZE))
  const page = Math.min(query.page, pageCount)
  const start = (page - 1) * VACANCY_LIST_PAGE_SIZE
  return { items: filtered.slice(start, start + VACANCY_LIST_PAGE_SIZE), total: filtered.length, page, pageCount }
}

function parseRpcResult(result: { readonly data: unknown; readonly error: { readonly message: string } | null }): Record<string, unknown> {
  if (result.error) throw recruitmentDatabaseError(result.error)
  if (typeof result.data !== 'object' || result.data === null || Array.isArray(result.data)) throw new RecruitmentError('RECRUITMENT_OPERATION_FAILED', 500)
  return result.data as Record<string, unknown>
}

export async function listRecruitmentVacancies(context: { readonly tenantId: string; readonly hrGroupId?: string }, supabase: SupabaseServerClient): Promise<VacancySummary[]> {
  if (!context.hrGroupId) throw new RecruitmentError('RECRUITMENT_HR_GROUP_REQUIRED', 403)
  const [vacancyResult, publicationResult, applicationResult] = await Promise.all([
    supabase.from('recruitment_vacancies').select('id,title,job_id,location_label,work_mode,min_hours,max_hours,salary_min,salary_max,salary_visible,status,version,updated_at').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).order('updated_at', { ascending: false }).limit(100),
    supabase.from('recruitment_publications').select('id,vacancy_id,slug,status,published_payload').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).limit(100),
    supabase.from('recruitment_applications').select('id,vacancy_id,terminal_outcome').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).limit(500),
  ])
  if (vacancyResult.error) throw recruitmentDatabaseError(vacancyResult.error)
  if (publicationResult.error) throw recruitmentDatabaseError(publicationResult.error)
  if (applicationResult.error) throw recruitmentDatabaseError(applicationResult.error)
  const publications = new Map(publicationResult.data.map((row) => [row.vacancy_id, publicationRowSchema.parse(row)]))
  const counts = new Map<string, { total: number; active: number }>()
  for (const application of applicationResult.data) {
    const count = counts.get(application.vacancy_id) ?? { total: 0, active: 0 }
    count.total += 1
    if (!application.terminal_outcome) count.active += 1
    counts.set(application.vacancy_id, count)
  }
  return vacancyResult.data.map((row) => {
    const vacancy = vacancyRowSchema.parse(row)
    const count = counts.get(vacancy.id) ?? { total: 0, active: 0 }
    const publication = publications.get(vacancy.id)
    return {
      id: vacancy.id, title: vacancy.title, locationLabel: vacancy.location_label, workMode: vacancy.work_mode,
      status: vacancy.status, updatedAt: vacancy.updated_at, version: vacancy.version,
      applicationCount: count.total, activeApplicationCount: count.active,
      publication: publication ? { id: publication.id, slug: publication.slug, status: publication.status, payload: publication.published_payload } : null,
    }
  })
}

export async function listRecruitmentVacancyPage(
  context: { readonly tenantId: string; readonly hrGroupId?: string },
  supabase: SupabaseServerClient,
  query: RecruitmentVacancyListQuery,
): Promise<RecruitmentVacancyListResult> {
  return paginateRecruitmentVacancies(await listRecruitmentVacancies(context, supabase), query)
}

export async function getRecruitmentVacancy(context: { readonly tenantId: string; readonly hrGroupId?: string }, vacancyId: string, supabase: SupabaseServerClient): Promise<VacancyDetail | null> {
  if (!context.hrGroupId) throw new RecruitmentError('RECRUITMENT_HR_GROUP_REQUIRED', 403)
  const vacancyResult = await supabase.from('recruitment_vacancies').select('id,title,job_id,location_label,work_mode,min_hours,max_hours,salary_min,salary_max,salary_visible,status,version,updated_at').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('id', vacancyId).maybeSingle()
  if (vacancyResult.error) throw recruitmentDatabaseError(vacancyResult.error)
  if (!vacancyResult.data) return null
  const [sectionsResult, publicationResult, applicationResult] = await Promise.all([
    supabase.from('recruitment_vacancy_sections').select('section_type,title,content,sort_order,is_visible').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('vacancy_id', vacancyId).order('sort_order'),
    supabase.from('recruitment_publications').select('id,slug,status,published_payload').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('vacancy_id', vacancyId).maybeSingle(),
    supabase.from('recruitment_applications').select('id,terminal_outcome').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('vacancy_id', vacancyId).limit(500),
  ])
  if (sectionsResult.error) throw recruitmentDatabaseError(sectionsResult.error)
  if (publicationResult.error) throw recruitmentDatabaseError(publicationResult.error)
  if (applicationResult.error) throw recruitmentDatabaseError(applicationResult.error)
  const vacancy = vacancyRowSchema.parse(vacancyResult.data)
  const sections = sectionsResult.data.map((row) => sectionRowSchema.parse(row)).map((row) => ({ sectionType: row.section_type, title: row.title, content: row.content, sortOrder: row.sort_order, isVisible: row.is_visible }))
  const count = { total: applicationResult.data.length, active: applicationResult.data.filter((row) => !row.terminal_outcome).length }
  const publication = publicationResult.data ? publicationRowSchema.parse(publicationResult.data) : null
  return {
    id: vacancy.id, title: vacancy.title, locationLabel: vacancy.location_label, workMode: vacancy.work_mode,
    status: vacancy.status, updatedAt: vacancy.updated_at, version: vacancy.version,
    applicationCount: count.total, activeApplicationCount: count.active, publication: publication ? { id: publication.id, slug: publication.slug, status: publication.status, payload: publication.published_payload } : null,
    jobId: vacancy.job_id, minHours: vacancy.min_hours, maxHours: vacancy.max_hours, salaryMin: vacancy.salary_min, salaryMax: vacancy.salary_max,
    salaryVisible: vacancy.salary_visible, sections,
  }
}

export async function saveRecruitmentVacancy(context: { readonly tenantId: string; readonly hrGroupId?: string }, input: VacancyInput, supabase: SupabaseServerClient, vacancyId?: string, expectedVersion = 1): Promise<{ readonly id: string; readonly version: number }> {
  if (!context.hrGroupId) throw new RecruitmentError('RECRUITMENT_HR_GROUP_REQUIRED', 403)
  const parsed = vacancyInputSchema.parse(input)
  const args: Record<string, unknown> = {
    requested_title: parsed.title, requested_job_id: parsed.jobId ?? null, requested_location_label: parsed.locationLabel,
    requested_work_mode: parsed.workMode, requested_min_hours: parsed.minHours, requested_max_hours: parsed.maxHours,
    requested_salary_min: parsed.salaryMin, requested_salary_max: parsed.salaryMax, requested_salary_visible: parsed.salaryVisible,
    requested_sections: toJsonSections(parsed.sections),
  }
  const result = vacancyId
    ? await rpc(supabase).rpc('update_recruitment_vacancy', { requested_vacancy_id: vacancyId, requested_expected_version: expectedVersion, ...args })
    : await rpc(supabase).rpc('create_recruitment_vacancy', { requested_tenant_id: context.tenantId, requested_hr_group_id: context.hrGroupId, ...args })
  const data = parseRpcResult(result)
  const id = data.id
  const version = data.version
  if (typeof id !== 'string' || typeof version !== 'number') throw new RecruitmentError('RECRUITMENT_OPERATION_FAILED', 500)
  return { id, version }
}

export async function updateRecruitmentPublication(context: { readonly tenantId: string; readonly hrGroupId?: string }, vacancyId: string, status: PublicationStatus, slug: string | null, payload: PublicationPayload, supabase: SupabaseServerClient): Promise<{ readonly id: string; readonly status: string; readonly slug: string }> {
  if (!context.hrGroupId) throw new RecruitmentError('RECRUITMENT_HR_GROUP_REQUIRED', 403)
  const parsedRequest = publicationRequestSchema.safeParse({ status, slug, payload })
  if (!parsedRequest.success) {
    if (status === 'OPEN' && (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) throw new RecruitmentError('RECRUITMENT_PUBLICATION_SLUG_INVALID', 422)
    throw new RecruitmentError('RECRUITMENT_PUBLICATION_INPUT_INVALID', 400)
  }
  const vacancy = await getRecruitmentVacancy(context, vacancyId, supabase)
  if (!vacancy) throw new RecruitmentError('RECRUITMENT_VACANCY_NOT_FOUND', 404)
  if (!canUpdateRecruitmentPublication(vacancy.status, status)) throw new RecruitmentError('RECRUITMENT_VACANCY_STATUS_INVALID', 422)
  if (!vacancy.publication && status !== 'OPEN') throw new RecruitmentError('RECRUITMENT_PUBLICATION_STATUS_INVALID', 422)
  const result = await rpc(supabase).rpc('publish_recruitment_vacancy', { requested_vacancy_id: vacancyId, requested_status: parsedRequest.data.status, requested_slug: parsedRequest.data.slug ?? null, requested_payload: parsedRequest.data.payload })
  const data = parseRpcResult(result)
  if (typeof data.id !== 'string' || typeof data.status !== 'string' || typeof data.slug !== 'string') throw new RecruitmentError('RECRUITMENT_OPERATION_FAILED', 500)
  return { id: data.id, status: data.status, slug: data.slug }
}
