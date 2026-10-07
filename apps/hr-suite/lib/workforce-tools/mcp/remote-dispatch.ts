import 'server-only'

import { randomUUID } from 'node:crypto'
import { requireHrGroupId } from '@/lib/auth/permissions'
import type { DelegatedWorkforceToolExecutionContext } from '@/lib/workforce-tools/contracts'
import { dispatchWorkforceTool, WorkforceToolDispatchError } from '@/lib/workforce-tools/registry'
import {
  createPostgresApiReadAuditWriter,
  type ApiReadAuditInput,
  type ApiReadAuditOutcome,
} from '@/lib/api-v1/security/audit'
import { PostgresApiRateLimiter } from '@/lib/api-v1/security/rate-limit'
import { RemoteMcpToolError, type RemoteMcpToolErrorCode } from './remote-errors'

const REMOTE_MCP_RATE_LIMIT_RESOURCE = 'employee-self-service' as const

function classifyToolError(error: unknown): {
  outcome: ApiReadAuditOutcome
  statusCode: number
  code: RemoteMcpToolErrorCode
} {
  if (error instanceof WorkforceToolDispatchError) {
    if (error.code === 'ACCESS_DENIED') {
      return { outcome: 'DENIED', statusCode: 403, code: 'MCP_AUTHORIZATION_DENIED' }
    }
    if (error.code === 'RESOURCE_NOT_FOUND' || error.code === 'MODULE_INACTIVE' || error.code === 'TOOL_NOT_FOUND') {
      return { outcome: 'DENIED', statusCode: 404, code: 'MCP_AUTHORIZATION_DENIED' }
    }
  }
  return { outcome: 'FAILED', statusCode: 500, code: 'MCP_SERVICE_UNAVAILABLE' }
}

function auditInput(
  execution: DelegatedWorkforceToolExecutionContext,
  oauthClientId: string,
  correlationId: string,
  outcome: ApiReadAuditOutcome,
  statusCode: number,
): ApiReadAuditInput {
  const context = execution.authContext
  return {
    tenantId: context.tenantId,
    actorUserId: context.userId,
    hrGroupId: requireHrGroupId(context),
    administrationId: context.administrationId,
    resource: REMOTE_MCP_RATE_LIMIT_RESOURCE,
    oauthClientId,
    correlationId,
    outcome,
    statusCode,
  }
}

async function writeAudit(
  writer: ReturnType<typeof createPostgresApiReadAuditWriter>,
  input: ApiReadAuditInput,
): Promise<void> {
  try {
    await writer.record(input)
  } catch {
    throw new RemoteMcpToolError('MCP_SERVICE_UNAVAILABLE')
  }
}

/**
 * Executes one remote tool call only after an atomic durable limiter consume.
 * Every context-resolved outcome is durably audited before a result/error is
 * returned to MCP. Audit or limiter outages fail closed.
 */
export async function dispatchRemoteMcpWorkforceTool(input: {
  readonly toolId: string
  readonly toolInput: unknown
  readonly oauthClientId: string
  readonly execution: DelegatedWorkforceToolExecutionContext
}): Promise<unknown> {
  const correlationId = randomUUID()
  let writer: ReturnType<typeof createPostgresApiReadAuditWriter>
  try {
    writer = createPostgresApiReadAuditWriter()
  } catch {
    throw new RemoteMcpToolError('MCP_SERVICE_UNAVAILABLE')
  }

  const rateInput = auditInput(input.execution, input.oauthClientId, correlationId, 'FAILED', 503)
  try {
    const decision = await new PostgresApiRateLimiter(input.execution.rls).consume({
      tenantId: rateInput.tenantId,
      hrGroupId: rateInput.hrGroupId,
      resource: REMOTE_MCP_RATE_LIMIT_RESOURCE,
      oauthClientId: input.oauthClientId,
    })
    if (!decision.allowed) {
      await writeAudit(writer, auditInput(
        input.execution,
        input.oauthClientId,
        correlationId,
        'RATE_LIMITED',
        429,
      ))
      throw new RemoteMcpToolError('MCP_RATE_LIMITED')
    }
  } catch (error) {
    if (error instanceof RemoteMcpToolError) throw error
    await writeAudit(writer, auditInput(
      input.execution,
      input.oauthClientId,
      correlationId,
      'FAILED',
      503,
    ))
    throw new RemoteMcpToolError('MCP_SERVICE_UNAVAILABLE')
  }

  let result: unknown
  try {
    result = await dispatchWorkforceTool(input.toolId, input.toolInput, input.execution)
  } catch (error) {
    const classified = classifyToolError(error)
    await writeAudit(writer, auditInput(
      input.execution,
      input.oauthClientId,
      correlationId,
      classified.outcome,
      classified.statusCode,
    ))
    throw new RemoteMcpToolError(classified.code)
  }

  await writeAudit(writer, auditInput(
    input.execution,
    input.oauthClientId,
    correlationId,
    'ALLOWED',
    200,
  ))
  return result
}
