import type { Database } from '@scope/db'
import { requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import type {
  TalentAssessmentCycleCreateInput,
  TalentAssessmentCycleUpdateInput,
  TalentAssessmentItemCreateInput,
  TalentAssessmentItemUpdateInput,
  TalentAssessmentListQuery,
  TalentAssessmentResponseCommandInput,
  TalentAssessmentResponseSaveInput,
} from './assessment-schemas'

export class TalentAssessmentError extends Error {
  constructor(public readonly code: string, public readonly status = 500) {
    super(code)
    this.name = 'TalentAssessmentError'
  }
}

type CycleRow = Database['public']['Tables']['talent_assessment_cycles']['Row']
type ItemRow = Database['public']['Tables']['talent_assessment_items']['Row']
type ResponseRow = Database['public']['Tables']['talent_assessment_responses']['Row']
type AnswerRow = Database['public']['Tables']['talent_assessment_answers']['Row']
type PrivateNoteRow = Database['public']['Tables']['talent_assessment_private_notes']['Row']

export type TalentAssessmentCycle = Pick<CycleRow, 'id' | 'code' | 'name' | 'description' | 'opens_on' | 'closes_on' | 'result_release_policy' | 'status' | 'version'>
export type TalentAssessmentItem = Pick<ItemRow, 'id' | 'cycle_id' | 'capability_id' | 'title' | 'prompt' | 'sort_order' | 'max_score' | 'is_required'> & { capabilityName: string | null }
export type TalentAssessmentAnswer = Pick<AnswerRow, 'id' | 'item_id' | 'score' | 'answer_text' | 'version'>
export type TalentAssessmentResponse = Pick<ResponseRow, 'id' | 'cycle_id' | 'subject_employee_id' | 'assessor_employee_id' | 'response_type' | 'status' | 'version' | 'submitted_at' | 'locked_at' | 'finalized_at' | 'reopened_at'> & {
  subjectLabel: string | null
  answers: TalentAssessmentAnswer[]
  privateNote: string | null
}

export type TalentAssessmentWorkspace = {
  cycles: TalentAssessmentCycle[]
  items: TalentAssessmentItem[]
  responses: TalentAssessmentResponse[]
  participants: Array<{ id: string; label: string }>
}

function databaseError(message: string, fallback: string): never {
  const normalized = message.toLocaleUpperCase('en-US')
  const explicitCode = normalized.match(/TALENT_[A-Z0-9_]+/)?.[0]
  if (explicitCode) {
    const status = explicitCode.includes('FORBIDDEN') ? 403 : explicitCode.includes('NOT_FOUND') ? 404 : explicitCode.includes('CONFLICT') || explicitCode.includes('DUPLICATE') || explicitCode.includes('LOCKED') ? 409 : 400
    throw new TalentAssessmentError(explicitCode, status)
  }
  if (normalized.includes('DUPLICATE') || normalized.includes('UNIQUE')) throw new TalentAssessmentError('TALENT_ASSESSMENT_DUPLICATE', 409)
  throw new TalentAssessmentError(fallback)
}

function cycleDto(row: CycleRow): TalentAssessmentCycle {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    opens_on: row.opens_on,
    closes_on: row.closes_on,
    result_release_policy: row.result_release_policy,
    status: row.status,
    version: row.version,
  }
}

function employeeLabel(firstName: string | null, birthName: string | null, employeeNumber: string | null): string | null {
  const name = [firstName, birthName].filter((value): value is string => Boolean(value?.trim())).join(' ').trim()
  if (!name && !employeeNumber) return null
  return [name || null, employeeNumber ? `(${employeeNumber})` : null].filter(Boolean).join(' ')
}

async function assessmentContext(mode: 'admin' | 'manager' | 'self'): Promise<AuthContext> {
  if (mode === 'admin') return requirePermission('talent-assessment:manage')
  if (mode === 'manager') return requirePermission('talent-assessment:read')
  return requirePermission('self:talent-assessment:read')
}

async function listAssessmentParticipants(context: AuthContext, mode: 'admin' | 'manager'): Promise<Array<{ id: string; label: string }>> {
  await requirePermission('talent-team:read')
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  let placementQuery = supabase
    .from('employee_organizations')
    .select('employee_id,effective_from,effective_to')
    .eq('tenant_id', context.tenantId)
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order('effective_from', { ascending: false })
    .limit(5000)
  if (mode === 'manager') {
    if (!context.employeeId) throw new TalentAssessmentError('TALENT_ASSESSMENT_EMPLOYEE_CONTEXT_REQUIRED', 403)
    placementQuery = placementQuery.eq('direct_manager_id', context.employeeId)
  }
  const { data: placements, error: placementError } = await placementQuery
  if (placementError) throw new TalentAssessmentError('TALENT_ASSESSMENT_PARTICIPANT_READ_FAILED')
  const employeeIds = [...new Set((placements ?? []).map((placement) => placement.employee_id))]
  if (employeeIds.length === 0) return []
  const { data: employees, error: employeeError } = await supabase
    .from('employees')
    .select('id,employee_number,first_name,birth_name')
    .eq('tenant_id', context.tenantId)
    .is('deleted_at', null)
    .in('id', employeeIds)
  if (employeeError) throw new TalentAssessmentError('TALENT_ASSESSMENT_PARTICIPANT_READ_FAILED')
  const employeeById = new Map((employees ?? []).map((employee) => [employee.id, employee]))
  return employeeIds.flatMap((employeeId) => {
    const employee = employeeById.get(employeeId)
    const label = employee ? employeeLabel(employee.first_name, employee.birth_name, employee.employee_number) : null
    return employee && label ? [{ id: employee.id, label }] : []
  })
}

export async function listTalentAssessmentWorkspace(mode: 'admin' | 'manager' | 'self', query: TalentAssessmentListQuery = {}): Promise<TalentAssessmentWorkspace> {
  const context = await assessmentContext(mode)
  await requireTenantModule('TALENT')
  const supabase = await createClient()

  let cyclesQuery = supabase.from('talent_assessment_cycles').select('*').eq('tenant_id', context.tenantId).order('opens_on', { ascending: false }).limit(100)
  if (query.cycleId) cyclesQuery = cyclesQuery.eq('id', query.cycleId)
  const { data: cycles, error: cyclesError } = await cyclesQuery
  if (cyclesError) throw new TalentAssessmentError('TALENT_ASSESSMENT_CYCLE_READ_FAILED')
  const cycleRows = cycles ?? []
  const cycleIds = cycleRows.map((cycle) => cycle.id)
  if (cycleIds.length === 0) return { cycles: [], items: [], responses: [], participants: [] }
  const participants = mode === 'self' ? [] : await listAssessmentParticipants(context, mode)

  const [itemsResult, responsesResult] = await Promise.all([
    supabase.from('talent_assessment_items').select('*').eq('tenant_id', context.tenantId).in('cycle_id', cycleIds).order('sort_order').limit(5000),
    (() => {
      let responseQuery = supabase.from('talent_assessment_responses').select('*').eq('tenant_id', context.tenantId).in('cycle_id', cycleIds).order('updated_at', { ascending: false }).limit(5000)
      if (query.responseType) responseQuery = responseQuery.eq('response_type', query.responseType)
      return responseQuery
    })(),
  ])
  if (itemsResult.error) throw new TalentAssessmentError('TALENT_ASSESSMENT_ITEM_READ_FAILED')
  if (responsesResult.error) throw new TalentAssessmentError('TALENT_ASSESSMENT_RESPONSE_READ_FAILED')
  const itemRows = itemsResult.data ?? []
  const responseRows = responsesResult.data ?? []
  const responseIds = responseRows.map((response) => response.id)
  const capabilityIds = [...new Set(itemRows.map((item) => item.capability_id).filter((id): id is string => Boolean(id)))]
  const subjectIds = [...new Set(responseRows.map((response) => response.subject_employee_id))]
  const [answersResult, notesResult, capabilitiesResult, employeesResult] = await Promise.all([
    responseIds.length > 0 ? supabase.from('talent_assessment_answers').select('*').eq('tenant_id', context.tenantId).in('response_id', responseIds).order('item_id') : Promise.resolve({ data: [] as AnswerRow[], error: null }),
    mode === 'self' || responseIds.length === 0 ? Promise.resolve({ data: [] as PrivateNoteRow[], error: null }) : supabase.from('talent_assessment_private_notes').select('*').eq('tenant_id', context.tenantId).in('response_id', responseIds),
    capabilityIds.length > 0 ? supabase.from('talent_capabilities').select('id,name').eq('tenant_id', context.tenantId).in('id', capabilityIds) : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null }),
    subjectIds.length > 0 ? supabase.from('employees').select('id,employee_number,first_name,birth_name').eq('tenant_id', context.tenantId).in('id', subjectIds) : Promise.resolve({ data: [] as Array<{ id: string; employee_number: string; first_name: string; birth_name: string }>, error: null }),
  ])
  if (answersResult.error || notesResult.error || capabilitiesResult.error || employeesResult.error) throw new TalentAssessmentError('TALENT_ASSESSMENT_DETAIL_READ_FAILED')

  const capabilityNames = new Map((capabilitiesResult.data ?? []).map((capability) => [capability.id, capability.name]))
  const employeeLabels = new Map((employeesResult.data ?? []).map((employee) => [employee.id, employeeLabel(employee.first_name, employee.birth_name, employee.employee_number)]))
  const answersByResponseId = new Map<string, TalentAssessmentAnswer[]>()
  for (const answer of answersResult.data ?? []) {
    const list = answersByResponseId.get(answer.response_id) ?? []
    list.push({ id: answer.id, item_id: answer.item_id, score: answer.score, answer_text: answer.answer_text, version: answer.version })
    answersByResponseId.set(answer.response_id, list)
  }
  const notesByResponseId = new Map((notesResult.data ?? []).map((note) => [note.response_id, note.note_text]))
  return {
    cycles: cycleRows.map(cycleDto),
    items: itemRows.map((item) => ({
      id: item.id,
      cycle_id: item.cycle_id,
      capability_id: item.capability_id,
      title: item.title,
      prompt: item.prompt,
      sort_order: item.sort_order,
      max_score: item.max_score,
      is_required: item.is_required,
      capabilityName: item.capability_id ? capabilityNames.get(item.capability_id) ?? null : null,
    })),
    responses: responseRows.map((response) => ({
      id: response.id,
      cycle_id: response.cycle_id,
      subject_employee_id: response.subject_employee_id,
      assessor_employee_id: response.assessor_employee_id,
      response_type: response.response_type,
      status: response.status,
      version: response.version,
      submitted_at: response.submitted_at,
      locked_at: response.locked_at,
      finalized_at: response.finalized_at,
      reopened_at: response.reopened_at,
      subjectLabel: employeeLabels.get(response.subject_employee_id) ?? null,
      answers: answersByResponseId.get(response.id) ?? [],
      privateNote: notesByResponseId.get(response.id) ?? null,
    })),
    participants,
  }
}

export async function createTalentAssessmentCycle(input: TalentAssessmentCycleCreateInput) {
  const context = await assessmentContext('admin')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data: cycle, error: cycleError } = await supabase.from('talent_assessment_cycles').insert({
    tenant_id: context.tenantId,
    code: input.code,
    name: input.name,
    description: input.description ?? null,
    opens_on: input.opensOn,
    closes_on: input.closesOn,
    created_by_user_id: context.userId,
    updated_by_user_id: context.userId,
  }).select('id').single()
  if (cycleError || !cycle) databaseError(cycleError?.message ?? 'TALENT_ASSESSMENT_CYCLE_CREATE_FAILED', 'TALENT_ASSESSMENT_CYCLE_CREATE_FAILED')
  const { error: itemError } = await supabase.from('talent_assessment_items').insert(input.items.map((item) => ({
    tenant_id: context.tenantId,
    cycle_id: cycle.id,
    capability_id: item.capabilityId ?? null,
    title: item.title,
    prompt: item.prompt,
    sort_order: item.sortOrder,
    max_score: item.maxScore,
    is_required: item.isRequired,
    created_by_user_id: context.userId,
    updated_by_user_id: context.userId,
  })))
  if (itemError) databaseError(itemError.message, 'TALENT_ASSESSMENT_ITEM_CREATE_FAILED')
  return cycle.id
}

export async function createTalentAssessmentItem(cycleId: string, input: TalentAssessmentItemCreateInput) {
  const context = await assessmentContext('admin')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data: cycle, error: cycleError } = await supabase.from('talent_assessment_cycles').select('id,status').eq('tenant_id', context.tenantId).eq('id', cycleId).maybeSingle()
  if (cycleError) databaseError(cycleError.message, 'TALENT_ASSESSMENT_CYCLE_READ_FAILED')
  if (!cycle) throw new TalentAssessmentError('TALENT_ASSESSMENT_CYCLE_NOT_FOUND', 404)
  if (cycle.status !== 'DRAFT') throw new TalentAssessmentError('TALENT_ASSESSMENT_CYCLE_NOT_EDITABLE', 409)
  const { data, error } = await supabase.from('talent_assessment_items').insert({
    tenant_id: context.tenantId,
    cycle_id: cycleId,
    capability_id: input.capabilityId ?? null,
    title: input.title,
    prompt: input.prompt,
    sort_order: input.sortOrder,
    max_score: input.maxScore,
    is_required: input.isRequired,
    created_by_user_id: context.userId,
    updated_by_user_id: context.userId,
  }).select('id').single()
  if (error || !data) databaseError(error?.message ?? 'TALENT_ASSESSMENT_ITEM_CREATE_FAILED', 'TALENT_ASSESSMENT_ITEM_CREATE_FAILED')
  return data.id
}

export async function updateTalentAssessmentItem(itemId: string, input: TalentAssessmentItemUpdateInput) {
  const context = await assessmentContext('admin')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data: existing, error: existingError } = await supabase.from('talent_assessment_items').select('id,cycle_id').eq('tenant_id', context.tenantId).eq('id', itemId).maybeSingle()
  if (existingError) databaseError(existingError.message, 'TALENT_ASSESSMENT_ITEM_READ_FAILED')
  if (!existing) throw new TalentAssessmentError('TALENT_ASSESSMENT_ITEM_NOT_FOUND', 404)
  const { data: cycle, error: cycleError } = await supabase.from('talent_assessment_cycles').select('status').eq('tenant_id', context.tenantId).eq('id', existing.cycle_id).maybeSingle()
  if (cycleError) databaseError(cycleError.message, 'TALENT_ASSESSMENT_CYCLE_READ_FAILED')
  if (!cycle) throw new TalentAssessmentError('TALENT_ASSESSMENT_CYCLE_NOT_FOUND', 404)
  if (cycle.status !== 'DRAFT') throw new TalentAssessmentError('TALENT_ASSESSMENT_CYCLE_NOT_EDITABLE', 409)
  const { data, error } = await supabase.from('talent_assessment_items').update({
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.prompt !== undefined ? { prompt: input.prompt } : {}),
    ...(input.capabilityId !== undefined ? { capability_id: input.capabilityId } : {}),
    ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
    ...(input.maxScore !== undefined ? { max_score: input.maxScore } : {}),
    ...(input.isRequired !== undefined ? { is_required: input.isRequired } : {}),
    updated_by_user_id: context.userId,
  }).eq('tenant_id', context.tenantId).eq('id', itemId).select('id').maybeSingle()
  if (error) databaseError(error.message, 'TALENT_ASSESSMENT_ITEM_UPDATE_FAILED')
  if (!data) throw new TalentAssessmentError('TALENT_ASSESSMENT_ITEM_NOT_FOUND', 404)
  return data.id
}

export async function updateTalentAssessmentCycle(cycleId: string, input: TalentAssessmentCycleUpdateInput) {
  const context = await assessmentContext('admin')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data, error } = await supabase.from('talent_assessment_cycles').update({
    name: input.name,
    description: input.description,
    opens_on: input.opensOn,
    closes_on: input.closesOn,
    status: input.status,
    version: input.version + 1,
    updated_by_user_id: context.userId,
  }).eq('tenant_id', context.tenantId).eq('id', cycleId).eq('version', input.version).select('id').maybeSingle()
  if (error) databaseError(error.message, 'TALENT_ASSESSMENT_CYCLE_UPDATE_FAILED')
  if (!data) throw new TalentAssessmentError('TALENT_ASSESSMENT_VERSION_CONFLICT', 409)
  return data.id
}

export async function saveTalentAssessmentResponse(input: TalentAssessmentResponseSaveInput) {
  const subjectEmployeeId = input.responseType === 'SELF' ? null : input.subjectEmployeeId
  const context = input.responseType === 'SELF'
    ? await requirePermission('self:talent-assessment:write')
    : subjectEmployeeId ? await requirePermission('talent-assessment:write', subjectEmployeeId) : (() => { throw new TalentAssessmentError('TALENT_ASSESSMENT_SUBJECT_REQUIRED', 400) })()
  await requireTenantModule('TALENT')
  if (!context.employeeId) throw new TalentAssessmentError('EMPLOYEE_CONTEXT_REQUIRED', 403)
  const supabase = await createClient()
  const resolvedSubjectId = subjectEmployeeId ?? context.employeeId
  const { data: cycle, error: cycleError } = await supabase.from('talent_assessment_cycles').select('id,status,opens_on,closes_on').eq('tenant_id', context.tenantId).eq('id', input.cycleId).maybeSingle()
  if (cycleError) throw new TalentAssessmentError('TALENT_ASSESSMENT_CYCLE_READ_FAILED')
  if (!cycle) throw new TalentAssessmentError('TALENT_ASSESSMENT_CYCLE_NOT_FOUND', 404)
  const today = new Date().toISOString().slice(0, 10)
  if (cycle.status !== 'OPEN' || today < cycle.opens_on || today >= cycle.closes_on) throw new TalentAssessmentError('TALENT_ASSESSMENT_CYCLE_CLOSED', 409)
  const { data: itemRows, error: itemError } = await supabase.from('talent_assessment_items').select('id,max_score,is_required').eq('tenant_id', context.tenantId).eq('cycle_id', input.cycleId)
  if (itemError) throw new TalentAssessmentError('TALENT_ASSESSMENT_ITEM_READ_FAILED')
  const itemsById = new Map((itemRows ?? []).map((item) => [item.id, item]))
  for (const answer of input.answers) {
    const item = itemsById.get(answer.itemId)
    if (!item) throw new TalentAssessmentError('TALENT_ASSESSMENT_ANSWER_ITEM_INVALID', 400)
    if (answer.score !== null && answer.score !== undefined && answer.score > item.max_score) throw new TalentAssessmentError('TALENT_ASSESSMENT_SCORE_INVALID', 400)
  }
  if (input.status === 'SUBMITTED') {
    for (const item of itemRows ?? []) {
      const answer = input.answers.find((candidate) => candidate.itemId === item.id)
      const hasAnswer = answer && (answer.score !== null && answer.score !== undefined || Boolean(answer.answerText?.trim()))
      if (item.is_required && !hasAnswer) throw new TalentAssessmentError('TALENT_ASSESSMENT_REQUIRED_ANSWER_MISSING', 400)
    }
  }
  const { data: existing, error: existingError } = await supabase.from('talent_assessment_responses').select('*').eq('tenant_id', context.tenantId).eq('cycle_id', input.cycleId).eq('subject_employee_id', resolvedSubjectId).eq('assessor_employee_id', context.employeeId).eq('response_type', input.responseType).maybeSingle()
  if (existingError) throw new TalentAssessmentError('TALENT_ASSESSMENT_RESPONSE_READ_FAILED')
  if (input.responseId && (!existing || existing.id !== input.responseId)) throw new TalentAssessmentError('TALENT_ASSESSMENT_RESPONSE_CONFLICT', 409)
  let response = existing
  if (!response) {
    const { data: created, error: createError } = await supabase.from('talent_assessment_responses').insert({
      tenant_id: context.tenantId,
      cycle_id: input.cycleId,
      subject_employee_id: resolvedSubjectId,
      assessor_employee_id: context.employeeId,
      response_type: input.responseType,
      created_by_user_id: context.userId,
      updated_by_user_id: context.userId,
    }).select('*').single()
    if (createError || !created) databaseError(createError?.message ?? 'TALENT_ASSESSMENT_RESPONSE_CREATE_FAILED', 'TALENT_ASSESSMENT_RESPONSE_CREATE_FAILED')
    response = created
  }
  if (!response) throw new TalentAssessmentError('TALENT_ASSESSMENT_RESPONSE_CREATE_FAILED')
  if (input.version !== undefined && input.version !== response.version) throw new TalentAssessmentError('TALENT_ASSESSMENT_VERSION_CONFLICT', 409)
  if (response.status !== 'DRAFT') throw new TalentAssessmentError('TALENT_ASSESSMENT_RESPONSE_LOCKED', 409)
  if (input.answers.length > 0) {
    const { error: answerError } = await supabase.from('talent_assessment_answers').upsert(input.answers.map((answer) => ({
      tenant_id: context.tenantId,
      response_id: response.id,
      item_id: answer.itemId,
      score: answer.score ?? null,
      answer_text: answer.answerText ?? null,
    })), { onConflict: 'tenant_id,response_id,item_id' })
    if (answerError) databaseError(answerError.message, 'TALENT_ASSESSMENT_ANSWER_SAVE_FAILED')
  }
  if (input.responseType === 'MANAGER' && input.privateNote !== undefined) {
    if (input.privateNote) {
      const { error: noteError } = await supabase.from('talent_assessment_private_notes').upsert({
        tenant_id: context.tenantId,
        response_id: response.id,
        note_text: input.privateNote,
        created_by_user_id: context.userId,
        updated_by_user_id: context.userId,
      }, { onConflict: 'tenant_id,response_id' })
      if (noteError) databaseError(noteError.message, 'TALENT_ASSESSMENT_PRIVATE_NOTE_SAVE_FAILED')
    }
  }
  const updatePayload = {
    status: input.status,
    version: response.version + 1,
    updated_by_user_id: context.userId,
  }
  const { data: updated, error: updateError } = await supabase.from('talent_assessment_responses').update(updatePayload).eq('tenant_id', context.tenantId).eq('id', response.id).eq('version', response.version).select('id,status,version').maybeSingle()
  if (updateError) databaseError(updateError.message, 'TALENT_ASSESSMENT_RESPONSE_SAVE_FAILED')
  if (!updated) throw new TalentAssessmentError('TALENT_ASSESSMENT_VERSION_CONFLICT', 409)
  return updated
}

export async function commandTalentAssessmentResponse(responseId: string, input: TalentAssessmentResponseCommandInput) {
  const context = await assessmentContext('admin')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data: current, error: currentError } = await supabase.from('talent_assessment_responses').select('status').eq('tenant_id', context.tenantId).eq('id', responseId).maybeSingle()
  if (currentError) databaseError(currentError.message, 'TALENT_ASSESSMENT_RESPONSE_READ_FAILED')
  if (!current) throw new TalentAssessmentError('TALENT_ASSESSMENT_RESPONSE_NOT_FOUND', 404)
  const validTransition = (current.status === 'SUBMITTED' && (input.status === 'LOCKED' || input.status === 'DRAFT')) || (current.status === 'LOCKED' && input.status === 'FINALIZED')
  if (!validTransition) throw new TalentAssessmentError('TALENT_ASSESSMENT_TRANSITION_INVALID', 409)
  const payload: Database['public']['Tables']['talent_assessment_responses']['Update'] = {
    status: input.status,
    version: input.version + 1,
    updated_by_user_id: context.userId,
    ...(input.status === 'DRAFT' ? { reopened_at: new Date().toISOString() } : {}),
  }
  const { data, error } = await supabase.from('talent_assessment_responses').update(payload).eq('tenant_id', context.tenantId).eq('id', responseId).eq('version', input.version).select('id,status,version').maybeSingle()
  if (error) databaseError(error.message, 'TALENT_ASSESSMENT_RESPONSE_COMMAND_FAILED')
  if (!data) throw new TalentAssessmentError('TALENT_ASSESSMENT_VERSION_CONFLICT', 409)
  return data
}
