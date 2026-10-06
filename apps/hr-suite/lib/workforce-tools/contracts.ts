import { z } from 'zod'
import type { ToggleableModuleCode } from '@/lib/modules/module-catalog'

export type WorkforceToolAudience = 'EMPLOYEE' | 'MANAGER' | 'HR'
export type WorkforceToolScope = 'SELF' | 'MANAGER_SCOPE' | 'TENANT'
export type WorkforceToolOperation = 'READ'

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
  readonly execute: (input: unknown) => Promise<z.output<TOutput>>
}

export type WorkforceToolInput<TTool extends WorkforceToolDefinition> = z.input<TTool['inputSchema']>
export type WorkforceToolOutput<TTool extends WorkforceToolDefinition> = z.output<TTool['outputSchema']>

type WorkforceToolDefinitionFactory<TInput extends z.ZodType, TOutput extends z.ZodType> =
  Omit<WorkforceToolDefinition<TInput, TOutput>, 'execute'> & {
    handler: (input: z.output<TInput>) => Promise<unknown>
  }

export function defineWorkforceTool<TInput extends z.ZodType, TOutput extends z.ZodType>(
  definition: WorkforceToolDefinitionFactory<TInput, TOutput>,
): WorkforceToolDefinition<TInput, TOutput> {
  const { handler, ...metadata } = definition

  return {
    ...metadata,
    execute: async (rawInput: unknown) => {
      const input = definition.inputSchema.parse(rawInput)
      const output = await handler(input)
      return definition.outputSchema.parse(output)
    },
  }
}
