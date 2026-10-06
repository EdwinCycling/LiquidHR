import type { TalentTeamMatrixCapability } from '@/lib/talent/team-model'
import { z } from 'zod'

export const teamSkillsProjectionSchema = z.array(z.object({
  capabilityCode: z.string().min(1),
  capabilityType: z.string().min(1),
  status: z.string().min(1),
  validFrom: z.iso.date(),
  validUntil: z.iso.date().nullable(),
}).strict())

/**
 * Kandidaatprojectie voor Team Skills. De resource blijft uitgesteld totdat
 * privacy- en linkabilitygoedkeuring is vastgelegd.
 */
export interface TeamSkillsProjection {
  readonly capabilityCode: string
  readonly capabilityType: string
  readonly status: string
  readonly validFrom: string
  readonly validUntil: string | null
}

type TeamSkillsProjectionSource = Pick<
  TalentTeamMatrixCapability,
  'capabilityCode' | 'capabilityType' | 'status' | 'valid_from' | 'valid_until'
>

/**
 * Projecteert uitsluitend de kandidaatvelden voor Team Skills.
 *
 * De aanroeper moet de bestaande Talent-teamservice gebruiken voor
 * autorisatie, tenant- en teamscope. Interne identifiers, labels, bewijs en
 * overige vrije tekst maken bewust geen deel uit van de projectie.
 */
export function projectTeamSkills(
  capabilities: ReadonlyArray<TeamSkillsProjectionSource>,
): TeamSkillsProjection[] {
  return capabilities.map((capability) => ({
    capabilityCode: capability.capabilityCode,
    capabilityType: capability.capabilityType,
    status: capability.status,
    validFrom: capability.valid_from,
    validUntil: capability.valid_until,
  }))
}
