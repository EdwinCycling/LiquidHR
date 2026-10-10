import { describe, expect, it } from 'vitest'
import { APP_VERSION } from '@/lib/app-version'
import { getWorkforceTool } from '../catalog'
import {
  CHATGPT_MCP_ALLOWED_STATUSES,
  CHATGPT_MCP_SERVER_INFO,
  CHATGPT_MCP_SERVER_METADATA,
  CHATGPT_MCP_TOOL_METADATA,
  CHATGPT_MCP_TOOLS,
  chatGptDevelopmentPlansInputSchema,
  chatGptDevelopmentPlansOutputSchema,
  projectChatGptDevelopmentPlansResult,
} from './chatgpt-metadata'

function record(value: unknown): Record<string, unknown> {
  expect(value).toBeTypeOf('object')
  expect(value).not.toBeNull()
  return value as Record<string, unknown>
}

describe('ChatGPT MCP metadata', () => {
  it('publishes stable server metadata without legacy plugin files or credentials', () => {
    expect(CHATGPT_MCP_SERVER_METADATA).toEqual({
      name: 'liquid-hr-workforce',
      version: APP_VERSION,
      instructions: expect.stringContaining('read-only'),
    })
    expect(CHATGPT_MCP_SERVER_INFO).toBe(CHATGPT_MCP_SERVER_METADATA)

    const serialized = JSON.stringify(CHATGPT_MCP_SERVER_METADATA).toLowerCase()
    expect(serialized).not.toContain('ai-plugin.json')
    expect(serialized).not.toContain('client_secret')
    expect(serialized).not.toContain('access_token')
    expect(serialized).not.toContain('service_role')
  })

  it('advertises only the approved self-only read tools for the remote TEST server', () => {
    const expectedIds = [
      'employee.talent.development-plans.read',
      'employee.talent.development-gaps.read',
      'employee.talent.skills.read',
      'employee.talent.competencies.read',
      'employee.leave.balance.read',
      'employee.leave.next.read',
      'employee.leave.requests.read',
      'employee.reminders.read',
    ]
    expect(CHATGPT_MCP_TOOL_METADATA).toHaveLength(8)
    expect(CHATGPT_MCP_TOOLS).toHaveLength(8)
    expect(CHATGPT_MCP_TOOL_METADATA.map((entry) => entry.workforceToolId)).toEqual(expectedIds)
    expect(CHATGPT_MCP_TOOLS.map((entry) => entry.name)).toEqual(expectedIds)

    for (const entry of CHATGPT_MCP_TOOL_METADATA) {
      const source = getWorkforceTool(entry.workforceToolId)
      expect(source).toBeDefined()
      expect(entry.exposure).toBe('REMOTE_TEST_ONLY')
      expect(entry.audience).toBe('EMPLOYEE')
      expect(entry.scope).toBe('SELF')
      expect(entry.operation).toBe('READ')
      expect(entry.permission).toMatch(/^self:/)
      expect(entry.tool.annotations?.readOnlyHint).toBe(true)
      expect(entry.tool.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['openid'] }])
    }

    const metadata = CHATGPT_MCP_TOOL_METADATA[0]
    const tool = CHATGPT_MCP_TOOLS[0]
    expect(metadata).toBeDefined()
    expect(tool).toBeDefined()
    expect(metadata?.workforceToolId).toBe('employee.talent.development-plans.read')
    expect(metadata?.exposure).toBe('REMOTE_TEST_ONLY')
    expect(metadata?.audience).toBe('EMPLOYEE')
    expect(metadata?.scope).toBe('SELF')
    expect(metadata?.operation).toBe('READ')
    expect(metadata?.permission).toBe('self:talent-goal:read')
    const sourceTool = getWorkforceTool('employee.talent.development-plans.read')
    expect(sourceTool).toBeDefined()
    expect(metadata?.workforceToolId).toBe(sourceTool?.id)
    expect(tool?.description).toContain('Lees de status en voortgang van je eigen ontwikkelplannen.')
    expect(tool?.description).toContain('De server bepaalt de actuele medewerkercontext; stuur geen employee-, tenant-, administratie- of rolselector mee.')
    expect(tool?.name).toBe(metadata?.workforceToolId)
    expect(tool?.annotations).toEqual({
      title: 'Eigen ontwikkelplannen lezen',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    })
    expect(metadata?.tool.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['openid'] }])
    expect(tool).not.toHaveProperty('_meta')
    expect(CHATGPT_MCP_TOOLS.map((entry) => entry.name)).not.toContain(
      'manager.talent.team-capability-matrix.read',
    )
    expect(CHATGPT_MCP_TOOLS.map((entry) => entry.name)).not.toContain(
      'hr.talent.tenant-capability-matrix.read',
    )
  })

  it('exposes minimal parameters and the approved structured output schema', () => {
    const tool = CHATGPT_MCP_TOOLS[0]
    expect(tool).toBeDefined()

    const inputSchema = record(tool?.inputSchema)
    expect(inputSchema.type).toBe('object')
    expect(inputSchema.properties).toEqual({})
    expect(inputSchema.additionalProperties).toBe(false)

    const outputSchema = record(tool?.outputSchema)
    expect(outputSchema.type).toBe('object')
    expect(outputSchema.additionalProperties).toBe(false)
    const outputProperties = record(outputSchema.properties)
    expect(Object.keys(outputProperties)).toEqual(['plans'])

    const plansSchema = record(outputProperties.plans)
    expect(plansSchema.type).toBe('array')
    const planSchema = record(plansSchema.items)
    expect(planSchema.additionalProperties).toBe(false)
    const planProperties = record(planSchema.properties)
    expect(Object.keys(planProperties)).toEqual([
      'periodStart',
      'periodEnd',
      'progressPercent',
      'status',
      'completedAt',
    ])
    expect(planSchema.required).toEqual([
      'periodStart',
      'periodEnd',
      'progressPercent',
      'status',
      'completedAt',
    ])
  })

  it('allows only the optional own-employment selector for the leave balance tool', () => {
    const balanceTool = CHATGPT_MCP_TOOLS.find((entry) => entry.name === 'employee.leave.balance.read')
    expect(balanceTool).toBeDefined()
    const inputSchema = record(balanceTool?.inputSchema)
    expect(Object.keys(record(inputSchema.properties))).toEqual(['employmentId'])
    expect(inputSchema.additionalProperties).toBe(false)

    const balanceDefinition = getWorkforceTool('employee.leave.balance.read')
    expect(balanceDefinition?.inputSchema.safeParse({}).success).toBe(true)
    expect(balanceDefinition?.inputSchema.safeParse({ employmentId: '00000000-0000-0000-0000-000000000001' }).success).toBe(true)
    for (const selector of ['employeeId', 'tenantId', 'hrGroupId', 'administrationId', 'role']) {
      expect(balanceDefinition?.inputSchema.safeParse({ [selector]: 'attacker-selected' }).success).toBe(false)
    }
  })

  it('rejects caller-selected context and internal fields at runtime', () => {
    expect(chatGptDevelopmentPlansInputSchema.safeParse({}).success).toBe(true)
    expect(chatGptDevelopmentPlansInputSchema.safeParse({ employeeId: 'other' }).success).toBe(false)
    expect(chatGptDevelopmentPlansInputSchema.safeParse({ tenantId: 'other' }).success).toBe(false)
    expect(chatGptDevelopmentPlansInputSchema.safeParse({ administrationId: 'other' }).success).toBe(false)
    expect(chatGptDevelopmentPlansInputSchema.safeParse({ role: 'HR' }).success).toBe(false)

    const valid = chatGptDevelopmentPlansOutputSchema.safeParse({
      plans: [{
        periodStart: '2026-01-01',
        periodEnd: null,
        progressPercent: 40,
        status: 'ACTIVE',
        completedAt: null,
      }],
    })
    expect(valid.success).toBe(true)
    expect(chatGptDevelopmentPlansOutputSchema.safeParse({
      plans: [{
        periodStart: '2026-01-01',
        periodEnd: null,
        progressPercent: 40,
        status: 'ACTIVE',
        completedAt: null,
        goalId: 'internal-id',
      }],
    }).success).toBe(false)
    expect(chatGptDevelopmentPlansOutputSchema.safeParse({
      plans: [{
        periodStart: '2026-01-01',
        periodEnd: null,
        progressPercent: 40,
        status: 'ACTIVE',
        completedAt: null,
        title: 'internal free text',
      }],
    }).success).toBe(false)
  })

  it('projects internal catalog results to the approved structured output', () => {
    const projected = projectChatGptDevelopmentPlansResult({
      plans: [{
        goalId: '00000000-0000-0000-0000-000000000001',
        title: 'Private title',
        capability: 'Private capability',
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        progressPercent: 40,
        status: 'ACTIVE',
        sourceType: 'SELF_ENTERED',
        completedAt: null,
        archivedAt: null,
      }],
    })

    expect(projected).toEqual({
      plans: [{
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        progressPercent: 40,
        status: 'ACTIVE',
        completedAt: null,
      }],
    })
    expect(JSON.stringify(projected)).not.toContain('00000000-0000-0000-0000-000000000001')
    expect(JSON.stringify(projected)).not.toContain('Private title')
    expect(JSON.stringify(projected)).not.toContain('Private capability')

    expect(() => projectChatGptDevelopmentPlansResult({
      plans: [{
        goalId: '00000000-0000-0000-0000-000000000001',
        title: 'Private title',
        capability: null,
        periodStart: '2026-01-01',
        periodEnd: null,
        progressPercent: 101,
        status: 'ACTIVE',
        sourceType: 'SELF_ENTERED',
        completedAt: null,
        archivedAt: null,
      }],
    })).toThrowError('CHATGPT_MCP_RESULT_INVALID')
  })

  it('keeps status values tied to the approved projection contract', () => {
    expect(CHATGPT_MCP_ALLOWED_STATUSES).toEqual([
      'DRAFT',
      'ACTIVE',
      'COMPLETED',
      'CANCELLED',
      'ARCHIVED',
    ])
  })
})
