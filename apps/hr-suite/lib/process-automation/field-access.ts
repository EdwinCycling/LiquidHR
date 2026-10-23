import type { FieldAccessMode, FieldDefinition } from './definition-schemas'

const capabilityRank: Readonly<Record<FieldAccessMode, number>> = {
  HIDDEN: 0,
  READ: 1,
  WRITE_OPTIONAL: 2,
  WRITE_REQUIRED: 2,
}

export function resolveStepFieldAccessMode(
  field: FieldDefinition,
  participantKey: string,
  stepKey?: string,
): FieldAccessMode {
  const participantMode = field.access.find((rule) => rule.participantKey === participantKey)?.mode ?? 'HIDDEN'
  if (!field.stepAccess) return participantMode
  if (!stepKey) return 'HIDDEN'
  const stepMode = field.stepAccess.find((rule) => rule.stepKey === stepKey && rule.participantKey === participantKey)?.mode
  if (!stepMode) return 'HIDDEN'
  return capabilityRank[stepMode] > capabilityRank[participantMode] ? participantMode : stepMode
}
