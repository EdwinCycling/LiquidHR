import 'server-only'

import { createHash } from 'node:crypto'
import { z } from 'zod'
import { AiExecutionError, type AiResultValidator, type AuthorizedContextLoader, type AiJsonValue, type AiInvocationInput, type AiExecutionResult } from '@/lib/ai/contracts'
import { IMPROVE_EXISTING_HR_TEXT_FEATURE } from '@/lib/ai/feature-registry'
import { createServerAiRuntimeDependencies, runAuthorizedAiInvocation } from '@/lib/ai/runtime'

export const employeeNoteAiTransformations = ['improve_writing', 'shorten', 'professionalize'] as const
export type EmployeeNoteAiTransformation = typeof employeeNoteAiTransformations[number]
export type EmployeeNoteAiLocale = 'nl' | 'en'

export const employeeNoteAiRequestSchema = z.object({
  sourceText: z.string().trim().min(1).max(4_000),
  transformation: z.enum(employeeNoteAiTransformations),
  locale: z.enum(['nl', 'en']),
}).strict()

export type EmployeeNoteAiRequest = z.infer<typeof employeeNoteAiRequestSchema>

export interface EmployeeNoteAiProposal {
  resultType: 'PROPOSAL'
  proposedText: string
  requiresHumanReview: true
}

export const employeeNoteAiProposalValidator: AiResultValidator<EmployeeNoteAiProposal> = {
  validate(output: unknown): EmployeeNoteAiProposal {
    if (typeof output !== 'object' || output === null || Array.isArray(output)) throw new AiExecutionError('INVALID_RESULT')
    const record = output as Record<string, unknown>
    const keys = Object.keys(record).sort().join(',')
    if (keys !== 'proposedText,requiresHumanReview,resultType') throw new AiExecutionError('INVALID_RESULT')
    if (record.resultType !== 'PROPOSAL' || record.requiresHumanReview !== true || typeof record.proposedText !== 'string') throw new AiExecutionError('INVALID_RESULT')
    const proposedText = record.proposedText.trim()
    if (!proposedText || proposedText.length > 4_000) throw new AiExecutionError('INVALID_RESULT')
    return { resultType: 'PROPOSAL', proposedText, requiresHumanReview: true }
  },
}

function businessObjectId(employeeId: string, request: EmployeeNoteAiRequest): string {
  return createHash('sha256').update(JSON.stringify({ employeeId, ...request })).digest('hex')
}

export function createEmployeeNoteAiContextLoader(request: EmployeeNoteAiRequest): AuthorizedContextLoader {
  return {
    async load(input): Promise<{ source: typeof input.businessObject; fields: Readonly<Record<string, AiJsonValue>> }> {
      return {
        source: input.businessObject,
        fields: {
          sourceText: request.sourceText,
          transformation: request.transformation,
          locale: request.locale,
        },
      }
    },
  }
}

export function createEmployeeNoteAiInvocationInput(employeeId: string, request: EmployeeNoteAiRequest, idempotencyKey: string): Omit<AiInvocationInput, 'authContext'> {
  return {
    featureCode: IMPROVE_EXISTING_HR_TEXT_FEATURE,
    businessObject: { type: 'employee-note-description', id: businessObjectId(employeeId, request) },
    idempotencyKey,
    businessPermissionCode: 'employee-note:write',
    businessPermissionTargetId: employeeId,
    qualityProfile: 'EFFICIENT',
    writingStyle: null,
  }
}

export async function improveEmployeeNoteDescription(input: { employeeId: string; request: EmployeeNoteAiRequest; idempotencyKey: string }): Promise<EmployeeNoteAiProposal> {
  const dependencies = createServerAiRuntimeDependencies({
    contextLoader: createEmployeeNoteAiContextLoader(input.request),
    validator: employeeNoteAiProposalValidator,
  })
  const result: AiExecutionResult<EmployeeNoteAiProposal> = await runAuthorizedAiInvocation(
    createEmployeeNoteAiInvocationInput(input.employeeId, input.request, input.idempotencyKey),
    dependencies,
  )
  if (result.kind === 'DUPLICATE') throw new AiExecutionError('DUPLICATE_COMPLETED')
  return result.output
}
