import { z } from 'zod'
import { listTalentTeamMatrix, type TalentTeamMatrixCapability, type TalentTeamMatrixRow } from '@/lib/talent/team-service'
import { talentTeamMatrixQuerySchema, type TalentTeamMatrixFilters } from '@/lib/talent/team-schemas'
import { defineWorkforceTool } from './contracts'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const MAX_ROWS_PER_PAGE = 25
const MAX_CAPABILITIES_PER_EMPLOYEE = 20
const workforceTeamCapabilityMatrixInputSchema = talentTeamMatrixQuerySchema.extend({
  status: z.enum(['RELEASED', 'EXPIRED']).optional(),
  limit: z.number().int().min(1).max(MAX_ROWS_PER_PAGE).optional(),
  offset: z.number().int().min(0).max(5_000).optional(),
})

const capabilityTypeSchema = z.enum(['COMPETENCY', 'SKILL', 'KNOWLEDGE', 'LANGUAGE', 'CERTIFICATE'])
const capabilityStatusSchema = z.enum(['RELEASED', 'EXPIRED'])
const capabilitySourceSchema = z.enum(['SELF_ENTERED', 'HR_ENTERED', 'MANAGER_ENTERED', 'IMPORTED'])

const managerCapabilitySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: capabilityTypeSchema,
  status: capabilityStatusSchema,
  sourceType: capabilitySourceSchema,
  validFrom: dateSchema,
  validUntil: dateSchema.nullable(),
}).strict()

const managerTeamRowSchema = z.object({
  employeeLabel: z.string().min(1),
  capabilities: z.array(managerCapabilitySchema).max(MAX_CAPABILITIES_PER_EMPLOYEE),
  capabilitiesTruncated: z.boolean(),
}).strict()

export const managerTeamCapabilityMatrixOutputSchema = z.object({
  rows: z.array(managerTeamRowSchema).max(MAX_ROWS_PER_PAGE),
  hasMore: z.boolean(),
  nextOffset: z.number().int().min(0).max(5_000).nullable(),
  sourceTruncated: z.boolean(),
}).strict()

type ManagerCapability = z.infer<typeof managerCapabilitySchema>

function isCapabilityStatus(status: string): status is ManagerCapability['status'] {
  return status === 'RELEASED' || status === 'EXPIRED'
}

function isCapabilityType(type: string): type is ManagerCapability['type'] {
  return capabilityTypeSchema.safeParse(type).success
}

function isCapabilitySource(source: string): source is ManagerCapability['sourceType'] {
  return capabilitySourceSchema.safeParse(source).success
}

function mapCapability(capability: TalentTeamMatrixCapability): ManagerCapability | null {
  if (!isCapabilityStatus(capability.status) || !isCapabilityType(capability.capabilityType) || !isCapabilitySource(capability.source_type)) return null

  return {
    code: capability.capabilityCode,
    name: capability.capabilityName,
    type: capability.capabilityType,
    status: capability.status,
    sourceType: capability.source_type,
    validFrom: capability.valid_from,
    validUntil: capability.valid_until,
  }
}

function mapTeamRow(row: TalentTeamMatrixRow): z.infer<typeof managerTeamRowSchema> {
  const capabilities = row.capabilities.flatMap((capability) => {
    const mapped = mapCapability(capability)
    return mapped ? [mapped] : []
  })
  return {
    employeeLabel: row.employeeLabel,
    capabilities: capabilities.slice(0, MAX_CAPABILITIES_PER_EMPLOYEE),
    capabilitiesTruncated: capabilities.length > MAX_CAPABILITIES_PER_EMPLOYEE,
  }
}

export async function executeTalentTeamCapabilityMatrix(
  input: z.output<typeof workforceTeamCapabilityMatrixInputSchema>,
): Promise<z.output<typeof managerTeamCapabilityMatrixOutputSchema>> {
  const { limit = MAX_ROWS_PER_PAGE, offset = 0, ...filters } = input
  const matrix = await listTalentTeamMatrix(filters satisfies TalentTeamMatrixFilters)
  const orderedRows = [...matrix.rows].sort((left, right) =>
    left.employeeNumber.localeCompare(right.employeeNumber, 'en')
    || left.employeeId.localeCompare(right.employeeId, 'en'),
  )
  const page = orderedRows.slice(offset, offset + limit)
  const nextOffset = offset + page.length < orderedRows.length ? offset + page.length : null
  return {
    rows: page.map(mapTeamRow),
    hasMore: nextOffset !== null,
    nextOffset,
    sourceTruncated: matrix.sourceTruncated,
  }
}

const managerToolMetadata = {
  audience: ['MANAGER'] as const,
  scope: 'MANAGER_SCOPE' as const,
  operation: 'READ' as const,
  module: 'TALENT' as const,
}

export const managerTeamCapabilityMatrixTool = defineWorkforceTool({
  ...managerToolMetadata,
  id: 'manager.talent.team-capability-matrix.read',
  description: 'Lees de toegestane capabilitygegevens van het directe team.',
  permission: 'talent-team:read',
  inputSchema: workforceTeamCapabilityMatrixInputSchema,
  outputSchema: managerTeamCapabilityMatrixOutputSchema,
  handler: executeTalentTeamCapabilityMatrix,
})

export const MANAGER_WORKFORCE_TOOLS = [managerTeamCapabilityMatrixTool] as const

export const managerWorkforceTools = MANAGER_WORKFORCE_TOOLS

export const hrTenantCapabilityMatrixTool = defineWorkforceTool({
  audience: ['HR'] as const,
  scope: 'TENANT' as const,
  operation: 'READ' as const,
  module: 'TALENT',
  id: 'hr.talent.tenant-capability-matrix.read',
  description: 'Lees de toegestane tenantbrede capabilitygegevens.',
  permission: 'talent-team:read',
  additionalPermissions: ['talent:manage'] as const,
  inputSchema: workforceTeamCapabilityMatrixInputSchema,
  outputSchema: managerTeamCapabilityMatrixOutputSchema,
  handler: executeTalentTeamCapabilityMatrix,
})

export const HR_WORKFORCE_TOOLS = [hrTenantCapabilityMatrixTool] as const

export const hrWorkforceTools = HR_WORKFORCE_TOOLS
