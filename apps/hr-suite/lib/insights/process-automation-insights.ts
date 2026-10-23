import { z } from 'zod'
import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

const dateValueSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
})

const querySchema = z.object({
  from: dateValueSchema,
  to: dateValueSchema,
  process: z.string().uuid().optional(),
  page: z.number().int().min(1).max(10000),
})

const countSchema = z.number().int().nonnegative()
const nullableSecondsSchema = z.number().nonnegative().nullable()

const processRowSchema = z.object({
  processDefinitionId: z.string().uuid(),
  processTitle: z.string(),
  versionNumber: z.number().int().positive(),
  started: countSchema,
  completed: countSchema,
  runningNow: countSchema,
  rejected: countSchema,
  cancelled: countSchema,
  averageLeadSeconds: nullableSecondsSchema,
  medianLeadSeconds: nullableSecondsSchema,
  slaDenominator: countSchema,
  slaWithin: countSchema,
  slaOutside: countSchema,
  sampleWorkItemId: z.string().uuid().nullable(),
})

const stepRowSchema = z.object({
  processTitle: z.string(),
  versionNumber: z.number().int().positive(),
  stepTitle: z.string(),
  waitSampleCount: countSchema,
  awaitingFirstClaimCount: countSchema,
  averageWaitSeconds: nullableSecondsSchema,
  medianWaitSeconds: nullableSecondsSchema,
  slaDenominator: countSchema,
  slaWithin: countSchema,
  slaOutside: countSchema,
})

const projectionSchema = z.object({
  fromDate: dateValueSchema,
  toDate: dateValueSchema,
  generatedAt: z.string(),
  summary: z.object({
    started: countSchema,
    completed: countSchema,
    runningNow: countSchema,
    rejected: countSchema,
    cancelled: countSchema,
    averageLeadSeconds: nullableSecondsSchema,
    medianLeadSeconds: nullableSecondsSchema,
    slaDenominator: countSchema,
    slaWithin: countSchema,
    slaOutside: countSchema,
  }),
  processTotal: countSchema,
  processes: z.array(processRowSchema),
  stepTotal: countSchema,
  steps: z.array(stepRowSchema),
  processOptions: z.array(z.object({ id: z.string().uuid(), title: z.string() })),
  page: countSchema,
  pageSize: countSchema,
})

export type ProcessInsightsQuery = z.infer<typeof querySchema>
export type ProcessInsightsReport = z.infer<typeof projectionSchema>

export class ProcessInsightsServiceError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'ProcessInsightsServiceError'
  }
}

function validDate(value: string | null): string | null {
  const parsed = dateValueSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function parseProcessInsightsQuery(params: URLSearchParams, today = new Date()): ProcessInsightsQuery | null {
  const rawTo = params.get('to')
  const rawFrom = params.get('from')
  if ((rawTo !== null && !validDate(rawTo)) || (rawFrom !== null && !validDate(rawFrom))) return null
  const to = validDate(rawTo) ?? today.toISOString().slice(0, 10)
  const defaultFrom = new Date(`${to}T00:00:00.000Z`)
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29)
  const from = validDate(rawFrom) ?? defaultFrom.toISOString().slice(0, 10)
  const rawPage = params.get('page')
  const parsed = querySchema.safeParse({
    from,
    to,
    ...(params.get('process') ? { process: params.get('process') } : {}),
    page: rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1,
  })
  if (!parsed.success || parsed.data.from > parsed.data.to) return null
  const start = new Date(`${parsed.data.from}T00:00:00.000Z`)
  const end = new Date(`${parsed.data.to}T00:00:00.000Z`)
  const days = Math.round((end.getTime() - start.getTime()) / 86400000)
  return days > 365 ? null : parsed.data
}

export async function getProcessInsightsReport(
  query: ProcessInsightsQuery,
  language: 'nl' | 'en',
): Promise<ProcessInsightsReport> {
  const context = await requirePermission('process-operations:read')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_process_insights_projection' as never, {
    requested_hr_group_id: hrGroupId,
    requested_from_date: query.from,
    requested_to_date: query.to,
    requested_process_definition_id: query.process ?? null,
    requested_page: query.page,
    requested_page_size: 20,
    requested_language: language,
  } as never)
  if (error) throw new ProcessInsightsServiceError('PROCESS_INSIGHTS_QUERY_FAILED')
  const parsed = projectionSchema.safeParse(data)
  if (!parsed.success) throw new ProcessInsightsServiceError('PROCESS_INSIGHTS_PROJECTION_INVALID')
  return parsed.data
}
