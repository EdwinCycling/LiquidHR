import { z } from 'zod'
import type { ActiveContext, AdministrationContextOption, HrGroupContextOption } from '@/lib/context/administration-context'

const postgresUuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
)

const hrGroupSelectionSchema = z.object({
  hrGroupId: postgresUuidSchema,
}).strict()

const administrationSelectionSchema = z.object({
  administrationId: postgresUuidSchema,
}).strict()

export interface HrGroupSelection {
  hrGroupId: string
}

export interface AdministrationSelection {
  administrationId: string
}

export class ContextSelectionError extends Error {
  constructor(message: string, readonly status: 400 | 403) {
    super(message)
  }
}

export function parseHrGroupSelection(input: unknown): HrGroupSelection {
  const result = hrGroupSelectionSchema.safeParse(input)
  if (!result.success) {
    throw new ContextSelectionError('Kies een geldige HR-groep.', 400)
  }
  return result.data
}

export function parseAdministrationSelection(input: unknown): AdministrationSelection {
  const result = administrationSelectionSchema.safeParse(input)
  if (!result.success) {
    throw new ContextSelectionError('Kies een geldige administratie.', 400)
  }
  return result.data
}

export function validateHrGroupSelection(
  context: ActiveContext,
  hrGroupId: string,
): HrGroupContextOption {
  const group = context.hrGroups.find((option) => option.id === hrGroupId)
  if (!group) {
    throw new ContextSelectionError('Je hebt geen toegang tot deze HR-groep.', 403)
  }
  return group
}

export function validateAdministrationSelection(
  context: ActiveContext,
  administrationId: string,
): AdministrationContextOption {
  const administration = context.administrationsInActiveHrGroup.find((option) => option.id === administrationId)
  if (!administration) {
    throw new ContextSelectionError('Je hebt geen toegang tot deze administratie binnen de actieve HR-groep.', 403)
  }

  return administration
}
