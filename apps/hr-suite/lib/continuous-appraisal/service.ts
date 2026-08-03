import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import type { Database } from '@scope/db'
import { AuthorizationError, requireAuthContext, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { employeeAvatarHref } from '@/lib/employees/employee-service'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type {
  ContinuousAppraisalCommentInput,
  ContinuousAppraisalCreateInput,
  ContinuousAppraisalListQuery,
  ContinuousAppraisalUpdateInput,
} from './schemas'

type ItemRow = Database['public']['Tables']['continuous_appraisal_items']['Row']
type CommentRow = Database['public']['Tables']['continuous_appraisal_item_comments']['Row']
type AttachmentRow = Database['public']['Tables']['continuous_appraisal_attachments']['Row']

const CONTINUOUS_APPRAISAL_ATTACHMENT_BUCKET = 'continuous-appraisal-attachments'
const CONTINUOUS_APPRAISAL_ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024
const CONTINUOUS_APPRAISAL_ATTACHMENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])

export type ContinuousAppraisalErrorCode =
  | 'CONTINUOUS_APPRAISAL_ITEM_NOT_FOUND'
  | 'CONTINUOUS_APPRAISAL_EMPLOYEE_NOT_FOUND'
  | 'CONTINUOUS_APPRAISAL_PAST_IMMUTABLE'
  | 'CONTINUOUS_APPRAISAL_FEEDBACK_MANAGER_ONLY'
  | 'CONTINUOUS_APPRAISAL_OWNER_INVALID'
  | 'CONTINUOUS_APPRAISAL_VERSION_CONFLICT'
  | 'CONTINUOUS_APPRAISAL_READ_FAILED'
  | 'CONTINUOUS_APPRAISAL_WRITE_FAILED'
  | 'CONTINUOUS_APPRAISAL_ATTACHMENT_INVALID'
  | 'CONTINUOUS_APPRAISAL_ATTACHMENT_UPLOAD_FAILED'
  | 'CONTINUOUS_APPRAISAL_ATTACHMENT_DOWNLOAD_FAILED'

export class ContinuousAppraisalError extends Error {
  constructor(public readonly code: ContinuousAppraisalErrorCode | string, public readonly status = 500) {
    super(code)
    this.name = 'ContinuousAppraisalError'
  }
}

export type ContinuousAppraisalComment = Pick<CommentRow, 'id' | 'author_employee_id' | 'author_label' | 'author_avatar_url' | 'body' | 'created_at'>

export type ContinuousAppraisalAttachment = Pick<AttachmentRow, 'id' | 'item_id' | 'original_filename' | 'content_type' | 'file_size' | 'created_at'> & {
  href: string
}

export type ContinuousAppraisalItem = Pick<ItemRow, 'id' | 'employee_id' | 'manager_employee_id' | 'created_by_employee_id' | 'created_by_label' | 'created_by_avatar_url' | 'owner_employee_id' | 'owner_label' | 'item_type' | 'goal_kind' | 'feedback_direction' | 'title' | 'body' | 'occurred_on' | 'due_on' | 'next_meeting_on' | 'item_status' | 'priority' | 'version' | 'created_at' | 'updated_at'> & {
  comments: ContinuousAppraisalComment[]
  attachments: ContinuousAppraisalAttachment[]
  canEdit: boolean
}

export type ContinuousAppraisalEmployeeOption = {
  id: string
  label: string
  employeeNumber: string
  jobTitle: string | null
  avatarUrl: string | null
}

export type ContinuousAppraisalWorkspace = {
  employeeId: string
  employee: ContinuousAppraisalEmployeeOption
  items: ContinuousAppraisalItem[]
  canWrite: boolean
  canCreateFeedback: boolean
}

export type ContinuousAppraisalSummary = {
  href: string
  workforceHref: string | null
  itemCount: number
  openActionCount: number
  latestItem: Pick<ContinuousAppraisalItem, 'id' | 'title' | 'item_type' | 'occurred_on'> | null
}

type EmployeeRow = {
  id: string
  first_name: string
  birth_name: string
  employee_number: string
  avatar_url: string | null
}

function employeeLabel(employee: Pick<EmployeeRow, 'first_name' | 'birth_name' | 'employee_number'>): string {
  return [employee.first_name, employee.birth_name].filter((part) => Boolean(part?.trim())).join(' ').trim() || employee.employee_number
}

function databaseError(message: string, fallback: ContinuousAppraisalErrorCode): never {
  const normalized = message.toLocaleUpperCase('en-US')
  const explicitCode = normalized.match(/CONTINUOUS_APPRAISAL_[A-Z0-9_]+/)?.[0]
  if (explicitCode) {
    const status = explicitCode.includes('NOT_FOUND') ? 404 : explicitCode.includes('FORBIDDEN') ? 403 : explicitCode.includes('IMMUTABLE') || explicitCode.includes('CONFLICT') ? 409 : 400
    throw new ContinuousAppraisalError(explicitCode, status)
  }
  throw new ContinuousAppraisalError(fallback)
}

async function employeeProfile(context: AuthContext, employeeId: string): Promise<EmployeeRow> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employees')
    .select('id, first_name, birth_name, employee_number, avatar_url')
    .eq('tenant_id', context.tenantId)
    .eq('id', employeeId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) databaseError(error.message, 'CONTINUOUS_APPRAISAL_READ_FAILED')
  if (!data) throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_EMPLOYEE_NOT_FOUND', 404)
  return data
}

function toEmployeeOption(employee: EmployeeRow, jobTitle: string | null = null): ContinuousAppraisalEmployeeOption {
  return {
    id: employee.id,
    label: employeeLabel(employee),
    employeeNumber: employee.employee_number,
    jobTitle,
    avatarUrl: employeeAvatarHref(employee.id, employee.avatar_url),
  }
}

async function canWriteTarget(employeeId: string): Promise<boolean> {
  try {
    await requirePermission('continuous-appraisal:write', employeeId)
    return true
  } catch (error) {
    if (error instanceof AuthorizationError) return false
    throw error
  }
}

async function currentManagerId(context: AuthContext, employeeId: string): Promise<string | null> {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('employee_organizations')
    .select('direct_manager_id')
    .eq('tenant_id', context.tenantId)
    .eq('employee_id', employeeId)
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data?.direct_manager_id ?? null
}

function toItem(row: ItemRow, comments: ContinuousAppraisalComment[], attachments: ContinuousAppraisalAttachment[], actorEmployeeId: string): ContinuousAppraisalItem {
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: row.id,
    employee_id: row.employee_id,
    manager_employee_id: row.manager_employee_id,
    created_by_employee_id: row.created_by_employee_id,
    created_by_label: row.created_by_label,
    created_by_avatar_url: row.created_by_avatar_url,
    owner_employee_id: row.owner_employee_id,
    owner_label: row.owner_label,
    item_type: row.item_type,
    goal_kind: row.goal_kind,
    feedback_direction: row.feedback_direction,
    title: row.title,
    body: row.body,
    occurred_on: row.occurred_on,
    due_on: row.due_on,
    next_meeting_on: row.next_meeting_on,
    item_status: row.item_status,
    priority: row.priority,
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
    comments,
    attachments,
    canEdit: row.created_by_employee_id === actorEmployeeId && row.occurred_on >= today && row.item_type !== 'SYSTEM_EVENT',
  }
}

export async function listContinuousAppraisalEmployeeOptions(): Promise<ContinuousAppraisalEmployeeOption[]> {
  const context = await requirePermission('continuous-appraisal:read')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employees')
    .select('id, first_name, birth_name, employee_number, avatar_url')
    .eq('tenant_id', context.tenantId)
    .eq('is_active', true)
    .eq('is_archived', false)
    .is('deleted_at', null)
    .order('first_name')
    .limit(500)
  if (error) databaseError(error.message, 'CONTINUOUS_APPRAISAL_READ_FAILED')
  return (data ?? []).map((employee) => toEmployeeOption(employee))
}

export async function listContinuousAppraisalWorkspace(targetEmployeeId: string, query: ContinuousAppraisalListQuery = {}): Promise<ContinuousAppraisalWorkspace> {
  const context = await requirePermission('continuous-appraisal:read', targetEmployeeId)
  const employee = await employeeProfile(context, targetEmployeeId)
  const supabase = await createClient()
  let itemsQuery = supabase
    .from('continuous_appraisal_items')
    .select('*')
    .eq('tenant_id', context.tenantId)
    .eq('employee_id', targetEmployeeId)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)
  if (query.itemType) itemsQuery = itemsQuery.eq('item_type', query.itemType)
  if (query.itemStatus) itemsQuery = itemsQuery.eq('item_status', query.itemStatus)
  const { data: rows, error: itemError } = await itemsQuery
  if (itemError) databaseError(itemError.message, 'CONTINUOUS_APPRAISAL_READ_FAILED')
  const filteredRows = (rows ?? []).filter((row) => {
    if (!query.search) return true
    const needle = query.search.toLocaleLowerCase('nl-NL')
    return `${row.title}\n${row.body}`.toLocaleLowerCase('nl-NL').includes(needle)
  })
  const itemIds = filteredRows.map((row) => row.id)
  const { data: commentRows, error: commentError } = itemIds.length > 0
    ? await supabase.from('continuous_appraisal_item_comments').select('*').eq('tenant_id', context.tenantId).in('item_id', itemIds).order('created_at')
    : { data: [] as CommentRow[], error: null }
  if (commentError) databaseError(commentError.message, 'CONTINUOUS_APPRAISAL_READ_FAILED')
  const { data: attachmentRows, error: attachmentError } = itemIds.length > 0
    ? await supabase.from('continuous_appraisal_attachments').select('id, item_id, original_filename, content_type, file_size, created_at').eq('tenant_id', context.tenantId).in('item_id', itemIds).order('created_at')
    : { data: [] as Array<Pick<AttachmentRow, 'id' | 'item_id' | 'original_filename' | 'content_type' | 'file_size' | 'created_at'>>, error: null }
  if (attachmentError) databaseError(attachmentError.message, 'CONTINUOUS_APPRAISAL_READ_FAILED')
  const commentsByItem = new Map<string, ContinuousAppraisalComment[]>()
  for (const comment of commentRows ?? []) {
    const list = commentsByItem.get(comment.item_id) ?? []
    list.push({ id: comment.id, author_employee_id: comment.author_employee_id, author_label: comment.author_label, author_avatar_url: comment.author_avatar_url, body: comment.body, created_at: comment.created_at })
    commentsByItem.set(comment.item_id, list)
  }
  const attachmentsByItem = new Map<string, ContinuousAppraisalAttachment[]>()
  for (const attachment of attachmentRows ?? []) {
    const list = attachmentsByItem.get(attachment.item_id) ?? []
    list.push({ ...attachment, href: `/api/continuous-appraisal/attachments/${attachment.id}` })
    attachmentsByItem.set(attachment.item_id, list)
  }
  const canWrite = await canWriteTarget(targetEmployeeId)
  return {
    employeeId: targetEmployeeId,
    employee: toEmployeeOption(employee),
    items: filteredRows.map((row) => toItem(row, commentsByItem.get(row.id) ?? [], attachmentsByItem.get(row.id) ?? [], context.employeeId ?? '')),
    canWrite,
    canCreateFeedback: context.permissions.includes('continuous-appraisal:write'),
  }
}

export async function getContinuousAppraisalSummary(): Promise<ContinuousAppraisalSummary | null> {
  const supabase = await createClient()
  const initialContext = await requireAuthContext(supabase)
  if (!initialContext.employeeId) return null
  const employeeId = initialContext.employeeId
  const context = await requirePermission('continuous-appraisal:read', employeeId)
  const { data, error } = await supabase
    .from('continuous_appraisal_items')
    .select('id, title, item_type, occurred_on, item_status')
    .eq('tenant_id', context.tenantId)
    .eq('employee_id', employeeId)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) databaseError(error.message, 'CONTINUOUS_APPRAISAL_READ_FAILED')
  const rows = data ?? []
  const openStatuses = new Set(['PLANNED', 'OPEN', 'WAITING', 'ACTIVE'])
  return {
    href: '/my-appraisal',
    workforceHref: context.permissions.includes('continuous-appraisal:read') ? `/workforce/continuous-appraisal?employeeId=${employeeId}` : null,
    itemCount: rows.length,
    openActionCount: rows.filter((row) => row.item_type === 'ACTION' && openStatuses.has(row.item_status)).length,
    latestItem: rows[0] ? { id: rows[0].id, title: rows[0].title, item_type: rows[0].item_type, occurred_on: rows[0].occurred_on } : null,
  }
}

export async function createContinuousAppraisalItem(input: ContinuousAppraisalCreateInput): Promise<{ id: string }> {
  const context = await requirePermission('continuous-appraisal:write', input.employeeId)
  if (input.itemType === 'FEEDBACK' && context.employeeId === input.employeeId) throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_FEEDBACK_MANAGER_ONLY', 403)
  const ownerEmployeeId = input.ownerEmployeeId ?? (input.itemType === 'ACTION' ? context.employeeId : null)
  if (ownerEmployeeId && ownerEmployeeId !== input.employeeId && ownerEmployeeId !== context.employeeId) throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_OWNER_INVALID', 400)
  if (!context.employeeId) throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_WRITE_FAILED')
  const [actor, target, managerId] = await Promise.all([
    employeeProfile(context, context.employeeId),
    employeeProfile(context, input.employeeId),
    currentManagerId(context, input.employeeId),
  ])
  const owner = ownerEmployeeId === context.employeeId ? actor : ownerEmployeeId === input.employeeId ? target : null
  const supabase = await createClient()
  const { data, error } = await supabase.from('continuous_appraisal_items').insert({
    tenant_id: context.tenantId,
    employee_id: input.employeeId,
    manager_employee_id: managerId,
    created_by_employee_id: context.employeeId,
    created_by_user_id: context.userId,
    created_by_label: employeeLabel(actor),
    created_by_avatar_url: employeeAvatarHref(actor.id, actor.avatar_url),
    owner_employee_id: ownerEmployeeId,
    owner_label: owner ? employeeLabel(owner) : null,
    item_type: input.itemType,
    goal_kind: input.goalKind ?? null,
    feedback_direction: input.itemType === 'FEEDBACK' ? 'MANAGER_TO_EMPLOYEE' : null,
    title: input.title,
    body: input.body,
    occurred_on: input.occurredOn,
    due_on: input.dueOn ?? null,
    next_meeting_on: input.nextMeetingOn ?? null,
    item_status: input.itemStatus,
    priority: input.priority ?? null,
  }).select('id').maybeSingle()
  if (error) databaseError(error.message, 'CONTINUOUS_APPRAISAL_WRITE_FAILED')
  if (!data) throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_WRITE_FAILED')
  return data
}

export async function updateContinuousAppraisalItem(itemId: string, input: ContinuousAppraisalUpdateInput): Promise<{ id: string; version: number }> {
  const supabase = await createClient()
  const { data: current, error: currentError } = await supabase.from('continuous_appraisal_items').select('*').eq('id', itemId).maybeSingle()
  if (currentError) databaseError(currentError.message, 'CONTINUOUS_APPRAISAL_READ_FAILED')
  if (!current) throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_ITEM_NOT_FOUND', 404)
  const context = await requirePermission('continuous-appraisal:write', current.employee_id)
  if (current.created_by_employee_id !== context.employeeId || current.item_type === 'SYSTEM_EVENT') throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_WRITE_FAILED', 403)
  const today = new Date().toISOString().slice(0, 10)
  if (current.occurred_on < today) throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_PAST_IMMUTABLE', 409)
  const owner = input.ownerEmployeeId === undefined ? null : input.ownerEmployeeId
  if (owner && owner !== current.employee_id && owner !== context.employeeId) throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_OWNER_INVALID', 400)
  const ownerProfile = owner ? await employeeProfile(context, owner) : null
  const { data, error } = await supabase.from('continuous_appraisal_items').update({
    title: input.title,
    body: input.body,
    due_on: input.dueOn,
    next_meeting_on: input.nextMeetingOn,
    item_status: input.itemStatus,
    priority: input.priority,
    owner_employee_id: input.ownerEmployeeId,
    owner_label: ownerProfile ? employeeLabel(ownerProfile) : input.ownerEmployeeId === null ? null : undefined,
    version: input.version + 1,
  }).eq('id', itemId).eq('version', input.version).select('id, version').maybeSingle()
  if (error) databaseError(error.message, 'CONTINUOUS_APPRAISAL_WRITE_FAILED')
  if (!data) throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_VERSION_CONFLICT', 409)
  return data
}

export async function addContinuousAppraisalComment(itemId: string, input: ContinuousAppraisalCommentInput): Promise<{ id: string }> {
  const supabase = await createClient()
  const { data: item, error: itemError } = await supabase.from('continuous_appraisal_items').select('tenant_id, employee_id').eq('id', itemId).maybeSingle()
  if (itemError) databaseError(itemError.message, 'CONTINUOUS_APPRAISAL_READ_FAILED')
  if (!item) throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_ITEM_NOT_FOUND', 404)
  const context = await requirePermission('continuous-appraisal:write', item.employee_id)
  if (!context.employeeId) throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_WRITE_FAILED')
  const actor = await employeeProfile(context, context.employeeId)
  const { data, error } = await supabase.from('continuous_appraisal_item_comments').insert({
    tenant_id: item.tenant_id,
    item_id: itemId,
    author_employee_id: context.employeeId,
    author_user_id: context.userId,
    author_label: employeeLabel(actor),
    author_avatar_url: employeeAvatarHref(actor.id, actor.avatar_url),
    body: input.body,
  }).select('id').maybeSingle()
  if (error) databaseError(error.message, 'CONTINUOUS_APPRAISAL_WRITE_FAILED')
  if (!data) throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_WRITE_FAILED')
  return data
}

function safeAttachmentFilename(filename: string): string {
  const normalized = filename.normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120)
  return normalized || 'attachment'
}

export async function createContinuousAppraisalAttachment(itemId: string, file: File): Promise<ContinuousAppraisalAttachment> {
  const supabase = await createClient()
  const { data: item, error: itemError } = await supabase
    .from('continuous_appraisal_items')
    .select('tenant_id, employee_id, occurred_on')
    .eq('id', itemId)
    .maybeSingle()
  if (itemError) databaseError(itemError.message, 'CONTINUOUS_APPRAISAL_READ_FAILED')
  if (!item) throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_ITEM_NOT_FOUND', 404)

  const context = await requirePermission('continuous-appraisal:write', item.employee_id)
  if (item.occurred_on < new Date().toISOString().slice(0, 10)) throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_PAST_IMMUTABLE', 409)
  if (!context.employeeId || !file.name.trim() || file.size < 1 || file.size > CONTINUOUS_APPRAISAL_ATTACHMENT_MAX_SIZE || !CONTINUOUS_APPRAISAL_ATTACHMENT_TYPES.has(file.type) || file.name.length > 255) {
    throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_ATTACHMENT_INVALID', 400)
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const attachmentId = randomUUID()
  const storageKey = `${context.tenantId}/${itemId}/${attachmentId}/${safeAttachmentFilename(file.name)}`
  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from(CONTINUOUS_APPRAISAL_ATTACHMENT_BUCKET)
    .upload(storageKey, bytes, { contentType: file.type, upsert: false })
  if (uploadError) throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_ATTACHMENT_UPLOAD_FAILED')

  const { data: attachment, error: metadataError } = await supabase
    .from('continuous_appraisal_attachments')
    .insert({
      id: attachmentId,
      tenant_id: context.tenantId,
      item_id: itemId,
      uploaded_by_employee_id: context.employeeId,
      uploaded_by_user_id: context.userId,
      storage_key: storageKey,
      original_filename: file.name,
      content_type: file.type,
      file_size: file.size,
      checksum_sha256: createHash('sha256').update(bytes).digest('hex'),
    })
    .select('id, item_id, original_filename, content_type, file_size, created_at')
    .maybeSingle()
  if (metadataError || !attachment) {
    await admin.storage.from(CONTINUOUS_APPRAISAL_ATTACHMENT_BUCKET).remove([storageKey])
    if (metadataError) databaseError(metadataError.message, 'CONTINUOUS_APPRAISAL_ATTACHMENT_UPLOAD_FAILED')
    throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_ATTACHMENT_UPLOAD_FAILED')
  }
  return { ...attachment, href: `/api/continuous-appraisal/attachments/${attachment.id}` }
}

export async function getContinuousAppraisalAttachmentDownload(attachmentId: string): Promise<string> {
  const supabase = await createClient()
  const { data: attachment, error } = await supabase
    .from('continuous_appraisal_attachments')
    .select('storage_key')
    .eq('id', attachmentId)
    .maybeSingle()
  if (error) databaseError(error.message, 'CONTINUOUS_APPRAISAL_READ_FAILED')
  if (!attachment) throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_ITEM_NOT_FOUND', 404)

  const { data: signed, error: signedError } = await createAdminClient().storage
    .from(CONTINUOUS_APPRAISAL_ATTACHMENT_BUCKET)
    .createSignedUrl(attachment.storage_key, 60)
  if (signedError || !signed?.signedUrl) throw new ContinuousAppraisalError('CONTINUOUS_APPRAISAL_ATTACHMENT_DOWNLOAD_FAILED')
  return signed.signedUrl
}
