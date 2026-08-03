import { z } from 'zod'

const databaseUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

export const talentRoleExplorerListQuerySchema = z.object({
  employeeId: databaseUuid.optional(),
  profileVersionId: databaseUuid.optional(),
}).strict()

export type TalentRoleExplorerListQuery = z.infer<typeof talentRoleExplorerListQuerySchema>
