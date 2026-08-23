import { z } from 'zod'

export const talentTeamMatrixCapabilityTypes = ['COMPETENCY', 'SKILL', 'KNOWLEDGE', 'LANGUAGE', 'CERTIFICATE'] as const
export const talentTeamMatrixStatuses = ['DRAFT', 'RELEASED', 'EXPIRED'] as const
export const talentTeamMatrixSources = ['SELF_ENTERED', 'HR_ENTERED', 'MANAGER_ENTERED', 'IMPORTED'] as const

export const talentTeamMatrixQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  type: z.enum(talentTeamMatrixCapabilityTypes).optional(),
  status: z.enum(talentTeamMatrixStatuses).optional(),
  source: z.enum(talentTeamMatrixSources).optional(),
}).strict()

export type TalentTeamMatrixFilters = z.infer<typeof talentTeamMatrixQuerySchema>

export function parseTalentTeamMatrixQuery(searchParams: URLSearchParams): ReturnType<typeof talentTeamMatrixQuerySchema.safeParse> {
  const value = (key: string) => {
    const raw = searchParams.get(key)?.trim()
    return raw || undefined
  }
  return talentTeamMatrixQuerySchema.safeParse({
    q: value('q'),
    type: value('type'),
    status: value('status'),
    source: value('source'),
  })
}
