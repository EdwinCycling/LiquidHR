import { describe, expect, it } from 'vitest'
import {
  registerWorkforceWebMcp,
  WorkforceWebMcpError,
  type WebMcpModelContext,
  type WebMcpTool,
  type WorkforceWebMcpDescriptor,
} from './webmcp'
import { listWorkforceToolDescriptors } from './registry'

const readDescriptor: WorkforceWebMcpDescriptor = {
  id: 'employee.talent.skills.read',
  description: 'Lees de eigen geregistreerde vaardigheden.',
  operation: 'READ',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
}

function createModelContext() {
  const tools: WebMcpTool[] = []
  const signals: AbortSignal[] = []
  const modelContext: WebMcpModelContext = {
    registerTool: (tool, options) => {
      tools.push(tool)
      if (options?.signal) signals.push(options.signal)
    },
  }
  return { modelContext, tools, signals }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('registerWorkforceWebMcp', () => {
  it('is a no-op when the browser does not expose modelContext', async () => {
    const registration = await registerWorkforceWebMcp({
      descriptors: [readDescriptor],
      modelContext: null,
    })

    expect(registration.supported).toBe(false)
    expect(registration.registeredToolNames).toEqual([])
    expect(() => registration.cleanup()).not.toThrow()
  })

  it('registers only read-only descriptors with bounded names and current WebMCP annotations', async () => {
    const { modelContext, tools } = createModelContext()
    const registration = await registerWorkforceWebMcp({
      modelContext,
      descriptors: [
        readDescriptor,
        {
          id: 'employee.talent.skills.write',
          description: 'Mutatie die nooit als WebMCP-tool mag verschijnen.',
          operation: 'WRITE',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          id: 'future.context.read',
          description: 'Descriptor met callercontext.',
          operation: 'READ',
          inputSchema: {
            type: 'object',
            properties: { tenantId: { type: 'string' } },
          },
        },
        {
          id: 'future.scalar.read',
          description: 'Descriptor met een scalar root-schema.',
          operation: 'READ',
          inputSchema: { type: 'string' },
        },
      ],
    })

    expect(registration.supported).toBe(true)
    expect(registration.registeredToolNames).toEqual(['liquidhr_employee_talent_skills_read'])
    expect(tools).toHaveLength(1)
    expect(tools[0]?.annotations).toEqual({
      readOnlyHint: true,
      untrustedContentHint: true,
      consequentialHint: false,
    })
    expect(tools[0]?.description).toContain('Alleen lezen binnen de huidige gebruikerscontext.')
  })

  it('calls the same-origin BFF with only tool input and normal browser credentials', async () => {
    const { modelContext, tools } = createModelContext()
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ input, init })
      return jsonResponse({ data: { skills: [] } })
    }
    await registerWorkforceWebMcp({ modelContext, descriptors: [readDescriptor], fetchImpl })

    const result = await tools[0]?.execute({}, { signal: new AbortController().signal })
    expect(result).toEqual({ skills: [] })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.input).toBe('/api/internal/workforce-tools')
    expect(calls[0]?.init?.method).toBe('POST')
    expect(calls[0]?.init?.credentials).toBe('same-origin')
    expect(calls[0]?.init?.cache).toBe('no-store')
    expect(calls[0]?.init?.body).toBe(JSON.stringify({
      toolId: readDescriptor.id,
      input: {},
    }))
    expect(calls[0]?.init?.body).not.toContain('tenantId')
  })

  it('validates required fields, patterns, and unknown keys before sending input to the BFF', async () => {
    const { modelContext, tools } = createModelContext()
    const calls: Array<{ body?: BodyInit | null }> = []
    const fetchImpl: typeof fetch = async (_input, init) => {
      calls.push({ body: init?.body })
      return jsonResponse({ data: { checkIns: [] } })
    }
    const goalCheckInsDescriptor: WorkforceWebMcpDescriptor = {
      id: 'employee.talent.goal-check-ins.read',
      description: 'Lees de eigen voortgangsmetadata van een ontwikkelplan.',
      operation: 'READ',
      inputSchema: {
        type: 'object',
        properties: {
          goalId: {
            type: 'string',
            pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
          },
        },
        required: ['goalId'],
        additionalProperties: false,
      },
    }

    await registerWorkforceWebMcp({ modelContext, descriptors: [goalCheckInsDescriptor], fetchImpl })

    await expect(tools[0]?.execute({})).rejects.toEqual(
      new WorkforceWebMcpError('WORKFORCE_REQUEST_INVALID'),
    )
    await expect(tools[0]?.execute({ goalId: 'invalid' })).rejects.toEqual(
      new WorkforceWebMcpError('WORKFORCE_REQUEST_INVALID'),
    )
    await expect(tools[0]?.execute({ goalId: '00000000-0000-0000-0000-000000000001', extra: true })).rejects.toEqual(
      new WorkforceWebMcpError('WORKFORCE_REQUEST_INVALID'),
    )
    expect(calls).toHaveLength(0)

    await tools[0]?.execute({ goalId: '00000000-0000-0000-0000-000000000001' })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.body).toBe(JSON.stringify({
      toolId: goalCheckInsDescriptor.id,
      input: { goalId: '00000000-0000-0000-0000-000000000001' },
    }))
  })

  it('registers every current Workforce catalog schema supported by the client validator', async () => {
    const { modelContext, tools } = createModelContext()
    const registration = await registerWorkforceWebMcp({
      modelContext,
      descriptors: listWorkforceToolDescriptors(),
      fetchImpl: async () => jsonResponse({ data: {} }),
    })

    expect(registration.registeredToolNames).toHaveLength(8)
    expect(tools).toHaveLength(8)
    expect(registration.registeredToolNames).toContain('liquidhr_manager_talent_team_capability_matrix_read')
    expect(registration.registeredToolNames).toContain('liquidhr_hr_talent_tenant_capability_matrix_read')
  })

  it('rejects caller-selected tenant, employee, and role context before any fetch', async () => {
    const { modelContext, tools } = createModelContext()
    let fetchCalls = 0
    const fetchImpl: typeof fetch = async () => {
      fetchCalls += 1
      return jsonResponse({ data: {} })
    }
    await registerWorkforceWebMcp({ modelContext, descriptors: [readDescriptor], fetchImpl })

    await expect(tools[0]?.execute({ employeeId: 'attacker-selected' })).rejects.toEqual(
      new WorkforceWebMcpError('WORKFORCE_REQUEST_INVALID'),
    )
    await expect(tools[0]?.execute({ nested: { role: 'HR_ADMIN' } })).rejects.toEqual(
      new WorkforceWebMcpError('WORKFORCE_REQUEST_INVALID'),
    )
    expect(fetchCalls).toBe(0)
  })

  it('maps server failures to bounded error codes without exposing response details', async () => {
    const { modelContext, tools } = createModelContext()
    const fetchImpl: typeof fetch = async () => jsonResponse({ error: 'Gevoelige database-details.' }, 500)
    await registerWorkforceWebMcp({ modelContext, descriptors: [readDescriptor], fetchImpl })

    await expect(tools[0]?.execute({})).rejects.toEqual(
      new WorkforceWebMcpError('WORKFORCE_TOOL_EXECUTION_FAILED'),
    )
  })

  it('unregisters and aborts in-flight execution when lifecycle cleanup runs', async () => {
    const { modelContext, tools, signals } = createModelContext()
    let resolveFetch: ((response: Response) => void) | undefined
    const fetchImpl: typeof fetch = async (_input, init) => new Promise<Response>((resolve, reject) => {
      resolveFetch = resolve
      init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')), { once: true })
    })
    const registration = await registerWorkforceWebMcp({ modelContext, descriptors: [readDescriptor], fetchImpl })
    const execution = tools[0]?.execute({})

    registration.cleanup()
    expect(signals[0]?.aborted).toBe(true)
    await expect(execution).rejects.toMatchObject({ name: 'AbortError' })
    resolveFetch?.(jsonResponse({ data: {} }))
  })

  it('rejects a cross-origin endpoint before registering a tool', async () => {
    const { modelContext, tools } = createModelContext()

    await expect(registerWorkforceWebMcp({
      modelContext,
      descriptors: [readDescriptor],
      endpoint: 'https://attacker.example/api/internal/workforce-tools',
    })).rejects.toEqual(new WorkforceWebMcpError('WEBMCP_ENDPOINT_INVALID'))
    expect(tools).toHaveLength(0)
  })
})
