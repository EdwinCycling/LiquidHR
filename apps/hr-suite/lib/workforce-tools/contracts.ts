import { z } from 'zod'
import type { ToggleableModuleCode } from '@/lib/modules/module-catalog'
import type { AuthContext } from '@/lib/auth/permissions'
import type { DelegatedBearerRlsClient, SupabaseBearerRlsClient } from '@/lib/api-v1/auth'

export type WorkforceToolAudience = 'EMPLOYEE' | 'MANAGER' | 'HR'
export type WorkforceToolScope = 'SELF' | 'MANAGER_SCOPE' | 'TENANT'
export type WorkforceToolOperation = 'READ'

export interface DelegatedWorkforceToolExecutionContext {
  readonly authContext: AuthContext
  readonly rls: DelegatedBearerRlsClient<SupabaseBearerRlsClient>
}

export interface WorkforceToolDefinition<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> {
  readonly id: string
  readonly description: string
  readonly audience: readonly WorkforceToolAudience[]
  readonly scope: WorkforceToolScope
  readonly operation: WorkforceToolOperation
  readonly permission: string
  readonly additionalPermissions?: readonly string[]
  readonly module: ToggleableModuleCode
  readonly inputSchema: TInput
  readonly outputSchema: TOutput
  readonly execute: (input: unknown, context?: DelegatedWorkforceToolExecutionContext) => Promise<z.output<TOutput>>
  readonly delegatedHandler?: (
    input: z.output<TInput>,
    context: DelegatedWorkforceToolExecutionContext,
  ) => Promise<unknown>
}

export type WorkforceToolInput<TTool extends WorkforceToolDefinition> = z.input<TTool['inputSchema']>
export type WorkforceToolOutput<TTool extends WorkforceToolDefinition> = z.output<TTool['outputSchema']>

type WorkforceToolDefinitionFactory<TInput extends z.ZodType, TOutput extends z.ZodType> =
  Omit<WorkforceToolDefinition<TInput, TOutput>, 'execute' | 'delegatedHandler'> & {
    handler: (input: z.output<TInput>) => Promise<unknown>
    delegatedHandler?: (
      input: z.output<TInput>,
      context: DelegatedWorkforceToolExecutionContext,
    ) => Promise<unknown>
    delegatedOutputSchema?: z.ZodType
  }

export function defineWorkforceTool<TInput extends z.ZodType, TOutput extends z.ZodType>(
  definition: WorkforceToolDefinitionFactory<TInput, TOutput>,
): WorkforceToolDefinition<TInput, TOutput> {
  const { handler, delegatedHandler, delegatedOutputSchema, ...metadata } = definition

  return {
    ...metadata,
    execute: async (rawInput: unknown, context?: DelegatedWorkforceToolExecutionContext): Promise<z.output<TOutput>> => {
      const input = definition.inputSchema.parse(rawInput)
      if (context) {
        if (!delegatedHandler) throw new Error('DELEGATED_WORKFORCE_TOOL_UNAVAILABLE')
        const output = await delegatedHandler(input, context)
        return (delegatedOutputSchema ?? definition.outputSchema).parse(output) as z.output<TOutput>
      }
      const output = await handler(input)
      return definition.outputSchema.parse(output)
    },
    ...(delegatedHandler === undefined ? {} : { delegatedHandler }),
  }
}
