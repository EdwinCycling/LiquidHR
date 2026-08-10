import type { Json } from '@scope/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

const localizedTextSchema = z.object({ nl: z.string(), en: z.string() }).passthrough()

const recipeSchema = z.object({
  id: z.string().uuid(),
  recipeKey: z.string(),
  recipeVersion: z.number().int().positive(),
  title: localizedTextSchema,
  description: localizedTextSchema,
  adapterKey: z.string(),
  status: z.enum(['PUBLISHED', 'RETIRED']),
}).strict()

const activationSchema = z.object({
  activationId: z.string().uuid(),
  processDefinitionId: z.string().uuid(),
  recipeId: z.string().uuid(),
  recipeKey: z.string(),
  recipeVersion: z.number().int().positive(),
  definitionKey: z.string().optional(),
  existing: z.boolean(),
}).strict()

const startContextSchema = z.object({
  recipeId: z.string().uuid(),
  recipeKey: z.string(),
  recipeVersion: z.number().int().positive(),
  adapterKey: z.string(),
  processDefinitionId: z.string().uuid(),
  definitionKey: z.string(),
  title: localizedTextSchema,
  description: localizedTextSchema.nullable(),
}).strict()

export type CertifiedRecipe = z.infer<typeof recipeSchema>
export type RecipeActivation = z.infer<typeof activationSchema>
export type ProcessRecipeStartContext = z.infer<typeof startContextSchema>

export class ProcessRecipeError extends Error {
  constructor(readonly code: string, readonly status: number, message = code) {
    super(message)
    this.name = 'ProcessRecipeError'
  }
}

function errorCode(message: string): string {
  return message.match(/\b[A-Z][A-Z0-9_]{2,80}\b/)?.[0] ?? 'PROCESS_RECIPE_OPERATION_FAILED'
}

function throwRpcError(message: string): never {
  const code = errorCode(message)
  const status = code.includes('FORBIDDEN') ? 403 : code.includes('NOT_FOUND') ? 404 : code.includes('CONFLICT') ? 409 : 400
  throw new ProcessRecipeError(code, status, message)
}

export async function listCertifiedRecipes(): Promise<readonly CertifiedRecipe[]> {
  const supabase = await createClient()
  await requirePermission('process-definition:read')
  const { data, error } = await supabase.rpc('get_process_recipe_catalog')
  if (error) throwRpcError(error.message)
  const parsed = z.array(recipeSchema).safeParse(data)
  if (!parsed.success) throw new ProcessRecipeError('PROCESS_RECIPE_CATALOG_INVALID', 500)
  return parsed.data
}

export async function activateCertifiedRecipe(recipeId: string, requestedKey?: string): Promise<RecipeActivation> {
  const supabase = await createClient()
  const context = await requirePermission('process-definition:write')
  const { data, error } = await supabase.rpc('activate_process_recipe', {
    requested_recipe_id: recipeId,
    requested_tenant_id: context.tenantId,
    requested_hr_group_id: requireHrGroupId(context),
    requested_scope_type: 'ADMINISTRATION',
    requested_administration_id: context.administrationId as string,
    requested_key: requestedKey ?? '',
  })
  if (error) throwRpcError(error.message)
  const parsed = activationSchema.safeParse(data)
  if (!parsed.success) throw new ProcessRecipeError('PROCESS_RECIPE_ACTIVATION_INVALID', 500)
  return parsed.data
}

export async function getProcessRecipeStartContext(recipeKey = 'internal-transfer'): Promise<ProcessRecipeStartContext> {
  const supabase = await createClient()
  const context = await requirePermission('process-instance:start').catch(async () => requirePermission('self:process-instance:start'))
  const { data, error } = await supabase.rpc('get_process_recipe_start_context', {
    requested_tenant_id: context.tenantId,
    requested_hr_group_id: requireHrGroupId(context),
    requested_recipe_key: recipeKey,
  })
  if (error) throwRpcError(error.message)
  const parsed = startContextSchema.safeParse(data)
  if (!parsed.success) throw new ProcessRecipeError('PROCESS_RECIPE_START_CONTEXT_INVALID', 500)
  return parsed.data
}

export function processRecipeErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof ProcessRecipeError)) return null
  return NextResponse.json({ code: error.code }, { status: error.status })
}

export type RecipeJson = Json
