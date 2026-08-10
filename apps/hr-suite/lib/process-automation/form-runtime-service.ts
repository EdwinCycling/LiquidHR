import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Json } from '@scope/db'
import { requireAuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { formProjectionSchema, formValuesSchema, type FormProjection, type FormValues } from './form-runtime'

export type FormRuntimeErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'ACTOR_EMPLOYEE_NOT_FOUND'
  | 'FORBIDDEN'
  | 'WORK_ITEM_NOT_FOUND'
  | 'WORK_ITEM_NOT_OPEN'
  | 'FORM_REQUIRED'
  | 'FORM_VERSION_NOT_FOUND'
  | 'FORM_LANGUAGE_NOT_PUBLISHED'
  | 'PROCESS_INSTANCE_NOT_ACTIVE'
  | 'STEP_NOT_ACTIVE'
  | 'STALE_FORM_RESPONSE'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'HIDDEN_FIELD_SUBMITTED'
  | 'UNKNOWN_FORM_FIELD'
  | 'FIELD_NOT_WRITABLE'
  | 'CURRENT_VALUE_CHANGED'
  | 'INVALID_FORM_VALUE'
  | 'REQUIRED_FORM_FIELD'
  | 'INVALID_FORM_PAYLOAD'
  | 'PROCESS_FORM_RUNTIME_OPERATION_FAILED'

const stableErrorCodes = new Set<FormRuntimeErrorCode>([
  'AUTHENTICATION_REQUIRED',
  'ACTOR_EMPLOYEE_NOT_FOUND',
  'FORBIDDEN',
  'WORK_ITEM_NOT_FOUND',
  'WORK_ITEM_NOT_OPEN',
  'FORM_REQUIRED',
  'FORM_VERSION_NOT_FOUND',
  'FORM_LANGUAGE_NOT_PUBLISHED',
  'PROCESS_INSTANCE_NOT_ACTIVE',
  'STEP_NOT_ACTIVE',
  'STALE_FORM_RESPONSE',
  'IDEMPOTENCY_KEY_REQUIRED',
  'HIDDEN_FIELD_SUBMITTED',
  'UNKNOWN_FORM_FIELD',
  'FIELD_NOT_WRITABLE',
  'CURRENT_VALUE_CHANGED',
  'INVALID_FORM_VALUE',
  'REQUIRED_FORM_FIELD',
  'INVALID_FORM_PAYLOAD',
  'PROCESS_FORM_RUNTIME_OPERATION_FAILED',
])

export class FormRuntimeError extends Error {
  constructor(readonly code: FormRuntimeErrorCode, readonly status: number, message: string = code) {
    super(message)
    this.name = 'FormRuntimeError'
  }
}

function codeFromRpcMessage(message: string): FormRuntimeErrorCode {
  const candidate = message.split(':', 1)[0]?.trim() ?? ''
  if (stableErrorCodes.has(candidate as FormRuntimeErrorCode)) return candidate as FormRuntimeErrorCode
  if (message.includes('permission denied')) return 'FORBIDDEN'
  return 'PROCESS_FORM_RUNTIME_OPERATION_FAILED'
}

function statusForCode(code: FormRuntimeErrorCode): number {
  if (code === 'AUTHENTICATION_REQUIRED') return 401
  if (code === 'FORBIDDEN' || code === 'ACTOR_EMPLOYEE_NOT_FOUND') return 403
  if (code === 'WORK_ITEM_NOT_FOUND' || code === 'FORM_VERSION_NOT_FOUND') return 404
  if (code === 'STALE_FORM_RESPONSE' || code === 'CURRENT_VALUE_CHANGED' || code === 'WORK_ITEM_NOT_OPEN' || code === 'PROCESS_INSTANCE_NOT_ACTIVE' || code === 'STEP_NOT_ACTIVE') return 409
  return 400
}

function throwFormRuntimeError(message: string): never {
  const code = codeFromRpcMessage(message)
  throw new FormRuntimeError(code, statusForCode(code), message)
}

export interface SaveProcessFormResponseCommand {
  readonly workItemId: string
  readonly expectedRevision: number
  readonly expectedVersion: number
  readonly values: FormValues
  readonly idempotencyKey: string
  readonly correlationId?: string | null
  readonly language: 'nl' | 'en'
}

export async function getProcessFormProjection(workItemId: string, language: 'nl' | 'en'): Promise<FormProjection> {
  const supabase = await createClient()
  await requireAuthContext(supabase)
  const { data, error } = await supabase.rpc('get_process_form_projection_with_bindings', {
    requested_work_item_id: workItemId,
    requested_language: language,
  })
  if (error) throwFormRuntimeError(error.message)
  const parsed = formProjectionSchema.safeParse(data)
  if (!parsed.success) throw new FormRuntimeError('PROCESS_FORM_RUNTIME_OPERATION_FAILED', 500)
  return parsed.data
}

export async function saveProcessFormResponse(command: SaveProcessFormResponseCommand): Promise<FormProjection> {
  const supabase = await createClient()
  await requireAuthContext(supabase)
  const values = formValuesSchema.parse(command.values)
  const { data, error } = await supabase.rpc('save_process_form_response_with_bindings', {
    requested_work_item_id: command.workItemId,
    requested_expected_revision: command.expectedRevision,
    requested_expected_version: command.expectedVersion,
    requested_values: values as Json,
    requested_idempotency_key: command.idempotencyKey,
    requested_correlation_id: command.correlationId as string,
    requested_language: command.language,
  })
  if (error) throwFormRuntimeError(error.message)
  const parsed = formProjectionSchema.safeParse(data)
  if (!parsed.success) throw new FormRuntimeError('PROCESS_FORM_RUNTIME_OPERATION_FAILED', 500)
  return parsed.data
}

export function formRuntimeErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof FormRuntimeError)) return null
  return NextResponse.json({ code: error.code }, { status: error.status })
}

export const formRuntimeErrorCodeFromMessage = codeFromRpcMessage

export const formLanguageSchema = z.enum(['nl', 'en'])
