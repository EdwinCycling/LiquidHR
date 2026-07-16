import { z } from 'zod'
import type { ActiveContext, AdministrationContextOption } from '@/lib/context/administration-context'

const postgresUuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
)

const administrationSelectionSchema = z.object({
  // PostgreSQL accepteert UUID's zonder RFC 4122-versiebits; de database-whitelist hieronder blijft de autorisatiegrens.
  administrationId: postgresUuidSchema,
}).strict()

export interface AdministrationSelection {
  administrationId: string
}

export class ContextSelectionError extends Error {
  constructor(message: string, readonly status: 400 | 403) {
    super(message)
  }
}

export function parseAdministrationSelection(input: unknown): AdministrationSelection {
  const result = administrationSelectionSchema.safeParse(input)
  if (!result.success) {
    throw new ContextSelectionError('Kies een geldige administratie.', 400)
  }
  return result.data
}

export function validateAdministrationSelection(
  context: ActiveContext,
  administrationId: string,
): AdministrationContextOption {
  if (context.tenant.administrationMode === 'COMBINED') {
    throw new ContextSelectionError('Deze klantomgeving werkt als één gecombineerde administratie.', 400)
  }

  const administration = context.administrations.find((option) => option.id === administrationId)
  if (!administration) {
    throw new ContextSelectionError('Je hebt geen toegang tot deze administratie.', 403)
  }

  return administration
}
