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

  it('advertises only the approved self-only Development Plans tool', () => {
    expect(CHATGPT_MCP_TOOL_METADATA).toHaveLength(1)
    expect(CHATGPT_MCP_TOOLS).toHaveLength(1)

    const metadata = CHATGPT_MCP_TOOL_METADATA[0]
    const tool = CHATGPT_MCP_TOOLS[0]
    expect(metadata).toBeDefined()
    expect(tool).toBeDefined()
    expect(metadata?.workforceToolId).toBe('employee.talent.development-plans.read')
    expect(metadata?.exposure).toBe('LOCAL_TEST_ONLY')
    expect(metadata?.audience).toBe('EMPLOYEE')
    expect(metadata?.scope).toBe('SELF')
    expect(metadata?.operation).toBe('READ')
    expect(metadata?.permission).toBe('self:talent-goal:read')
    const sourceTool = getWorkforceTool('employee.talent.development-plans.read')
    expect(sourceTool).toBeDefined()
    expect(metadata?.workforceToolId).toBe(sourceTool?.id)
    expect(tool?.description).toContain(sourceTool?.description)
    expect(tool?.name).toBe(metadata?.workforceToolId)
    expect(tool?.annotations).toEqual({
      title: 'Eigen ontwikkelplannen lezen',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    })
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
