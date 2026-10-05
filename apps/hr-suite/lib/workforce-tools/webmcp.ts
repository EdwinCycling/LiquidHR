/**
 * Experimental browser adapter for the WebMCP imperative API.
 *
 * This module is deliberately independent from the server-side Workforce
 * registry. The browser receives serializable descriptors from server wiring
 * and can only call the cookie-authenticated same-origin BFF. The BFF remains
 * the source of truth for authentication, authorization, tenant context and
 * RLS.
 */

export interface WebMcpJsonSchema {
  readonly [key: string]: unknown
}

export interface WorkforceWebMcpDescriptor {
  readonly id: string
  readonly description: string
  readonly operation: 'READ' | string
  readonly inputSchema: WebMcpJsonSchema
}

export interface WebMcpExecutionContext {
  readonly signal?: AbortSignal
}

export interface WebMcpTool {
  readonly name: string
  readonly description: string
  readonly inputSchema: WebMcpJsonSchema
  readonly annotations: {
    readonly readOnlyHint: true
    readonly untrustedContentHint: true
    readonly consequentialHint: false
  }
  readonly execute: (input: unknown, context?: WebMcpExecutionContext) => Promise<unknown>
}

export interface WebMcpModelContext {
  registerTool: (
    tool: WebMcpTool,
    options?: { readonly signal?: AbortSignal },
  ) => void | Promise<void>
}

export interface WorkforceWebMcpRegistration {
  readonly supported: boolean
  readonly registeredToolNames: readonly string[]
  readonly cleanup: () => void
}

export interface RegisterWorkforceWebMcpOptions {
  readonly descriptors: readonly WorkforceWebMcpDescriptor[]
  /** Relative same-origin BFF path. Absolute and protocol-relative URLs are rejected. */
  readonly endpoint?: string
  readonly lifecycleSignal?: AbortSignal
  readonly modelContext?: WebMcpModelContext | null
  readonly fetchImpl?: typeof fetch
}

export type WorkforceWebMcpErrorCode =
  | 'WEBMCP_ENDPOINT_INVALID'
  | 'WEBMCP_FETCH_UNAVAILABLE'
  | 'WORKFORCE_REQUEST_INVALID'
  | 'WORKFORCE_REQUEST_FORBIDDEN'
  | 'AUTHENTICATION_REQUIRED'
  | 'ACCESS_DENIED'
  | 'CONTEXT_SELECTION_REQUIRED'
  | 'TOOL_NOT_FOUND'
  | 'MODULE_INACTIVE'
  | 'RESOURCE_NOT_FOUND'
  | 'WORKFORCE_TOOL_EXECUTION_FAILED'

export class WorkforceWebMcpError extends Error {
  constructor(readonly code: WorkforceWebMcpErrorCode) {
    super(code)
    this.name = 'WorkforceWebMcpError'
  }
}

const DEFAULT_ENDPOINT = '/api/internal/workforce-tools'
const TOOL_NAME_PREFIX = 'liquidhr_'

// These values are server-owned context. They must never be selected by a
// browser caller, even if a future descriptor accidentally exposes them.
const FORBIDDEN_CONTEXT_KEYS = new Set([
  'tenantid',
  'employeeid',
  'userid',
  'role',
  'roles',
  'administrationid',
  'hrgroupid',
  'departmentid',
  'teamid',
  'manageremployeeid',
  'context',
  'identity',
])

const BOUNDED_ERROR_CODES = new Set<WorkforceWebMcpErrorCode>([
  'WEBMCP_ENDPOINT_INVALID',
  'WEBMCP_FETCH_UNAVAILABLE',
  'WORKFORCE_REQUEST_INVALID',
  'WORKFORCE_REQUEST_FORBIDDEN',
  'AUTHENTICATION_REQUIRED',
  'ACCESS_DENIED',
  'CONTEXT_SELECTION_REQUIRED',
  'TOOL_NOT_FOUND',
  'MODULE_INACTIVE',
  'RESOURCE_NOT_FOUND',
  'WORKFORCE_TOOL_EXECUTION_FAILED',
])

function getModelContext(): WebMcpModelContext | null {
  if (typeof document === 'undefined') return null
  const candidate = (document as Document & { modelContext?: unknown }).modelContext
  if (typeof candidate !== 'object' || candidate === null) return null
  const registerTool = (candidate as { registerTool?: unknown }).registerTool
  return typeof registerTool === 'function' ? candidate as WebMcpModelContext : null
}

function normalizeEndpoint(endpoint: string): string {
  if (!endpoint.startsWith('/') || endpoint.startsWith('//')) {
    throw new WorkforceWebMcpError('WEBMCP_ENDPOINT_INVALID')
  }
  return endpoint
}

function toWebMcpToolName(toolId: string): string {
  const normalized = toolId.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
  return `${TOOL_NAME_PREFIX}${normalized}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function containsForbiddenContextKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenContextKey)
  if (!isRecord(value)) return false

  return Object.entries(value).some(([key, nested]) =>
    FORBIDDEN_CONTEXT_KEYS.has(key.toLowerCase()) || containsForbiddenContextKey(nested),
  )
}

function descriptorContainsForbiddenContextKey(schema: unknown): boolean {
  if (Array.isArray(schema)) return schema.some(descriptorContainsForbiddenContextKey)
  if (!isRecord(schema)) return false

  const properties = schema.properties
  if (isRecord(properties) && Object.keys(properties).some((key) => FORBIDDEN_CONTEXT_KEYS.has(key.toLowerCase()))) {
    return true
  }

  return Object.values(schema).some(descriptorContainsForbiddenContextKey)
}

const SUPPORTED_INPUT_SCHEMA_KEYS = new Set([
  '$schema',
  'title',
  'description',
  'type',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'enum',
  'const',
  'minimum',
  'maximum',
  'minLength',
  'maxLength',
  'pattern',
])

function isSupportedInputSchema(schema: unknown, depth = 0): schema is WebMcpJsonSchema {
  if (!isRecord(schema) || depth > 16) return false
  if (Object.keys(schema).some((key) => !SUPPORTED_INPUT_SCHEMA_KEYS.has(key))) return false

  const schemaType = schema.type
  if (schemaType !== undefined && !['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'].includes(String(schemaType))) {
    return false
  }

  if (schema.properties !== undefined) {
    if (!isRecord(schema.properties)) return false
    if (!Object.values(schema.properties).every((propertySchema) => isSupportedInputSchema(propertySchema, depth + 1))) {
      return false
    }
  }
  if (schema.required !== undefined && (!Array.isArray(schema.required) || !schema.required.every((key) => typeof key === 'string'))) {
    return false
  }
  if (schema.additionalProperties !== undefined
    && typeof schema.additionalProperties !== 'boolean'
    && !isSupportedInputSchema(schema.additionalProperties, depth + 1)) {
    return false
  }
  if (schema.items !== undefined && !isSupportedInputSchema(schema.items, depth + 1)) return false
  if (schema.enum !== undefined && !Array.isArray(schema.enum)) return false
  if (schema.minimum !== undefined && (typeof schema.minimum !== 'number' || !Number.isFinite(schema.minimum))) return false
  if (schema.maximum !== undefined && (typeof schema.maximum !== 'number' || !Number.isFinite(schema.maximum))) return false
  if (schema.minLength !== undefined && (!Number.isInteger(schema.minLength) || Number(schema.minLength) < 0)) return false
  if (schema.maxLength !== undefined && (!Number.isInteger(schema.maxLength) || Number(schema.maxLength) < 0)) return false
  if (schema.pattern !== undefined) {
    if (typeof schema.pattern !== 'string') return false
    try {
      new RegExp(schema.pattern)
    } catch {
      return false
    }
  }

  return true
}

function matchesJsonSchema(value: unknown, schema: WebMcpJsonSchema, depth = 0): boolean {
  if (!isSupportedInputSchema(schema, depth)) return false

  if (Array.isArray(schema.enum) && !schema.enum.some((allowed) => Object.is(value, allowed))) return false
  if (Object.prototype.hasOwnProperty.call(schema, 'const') && !Object.is(value, schema.const)) return false

  switch (schema.type) {
    case 'object': {
      if (!isRecord(value)) return false
      const properties = isRecord(schema.properties) ? schema.properties : {}
      const required = Array.isArray(schema.required) ? schema.required as string[] : []
      if (!required.every((key) => Object.prototype.hasOwnProperty.call(value, key))) return false
      for (const [key, propertyValue] of Object.entries(value)) {
        const propertySchema = properties[key]
        if (propertySchema !== undefined) {
          if (!isRecord(propertySchema) || !matchesJsonSchema(propertyValue, propertySchema, depth + 1)) return false
        } else if (schema.additionalProperties === false) {
          return false
        } else if (isRecord(schema.additionalProperties)
          && !matchesJsonSchema(propertyValue, schema.additionalProperties, depth + 1)) {
          return false
        }
      }
      return true
    }
    case 'array':
      return Array.isArray(value)
        && (schema.items === undefined
          || (isRecord(schema.items) && value.every((item) => matchesJsonSchema(item, schema.items as WebMcpJsonSchema, depth + 1))))
    case 'string':
      return typeof value === 'string'
        && (schema.minLength === undefined || value.length >= Number(schema.minLength))
        && (schema.maxLength === undefined || value.length <= Number(schema.maxLength))
        && (schema.pattern === undefined || new RegExp(String(schema.pattern)).test(value))
    case 'integer':
      return typeof value === 'number'
        && Number.isInteger(value)
        && (schema.minimum === undefined || value >= Number(schema.minimum))
        && (schema.maximum === undefined || value <= Number(schema.maximum))
    case 'number':
      return typeof value === 'number'
        && Number.isFinite(value)
        && (schema.minimum === undefined || value >= Number(schema.minimum))
        && (schema.maximum === undefined || value <= Number(schema.maximum))
    case 'boolean':
      return typeof value === 'boolean'
    case 'null':
      return value === null
    default:
      return true
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return
  if (typeof DOMException !== 'undefined') throw new DOMException('The operation was aborted.', 'AbortError')
  throw new Error('AbortError')
}

function combineAbortSignals(first: AbortSignal, second?: AbortSignal): AbortSignal {
  if (!second) return first
  if (first.aborted) return first
  if (second.aborted) return second

  const abortSignalConstructor = AbortSignal as typeof AbortSignal & {
    any?: (signals: readonly AbortSignal[]) => AbortSignal
  }
  if (typeof abortSignalConstructor.any === 'function') {
    return abortSignalConstructor.any([first, second])
  }

  const controller = new AbortController()
  const abort = () => controller.abort()
  first.addEventListener('abort', abort, { once: true })
  second.addEventListener('abort', abort, { once: true })
  return controller.signal
}

function errorCodeFromPayload(payload: unknown): WorkforceWebMcpErrorCode {
  if (!isRecord(payload)) return 'WORKFORCE_TOOL_EXECUTION_FAILED'
  const code = payload.error
  return typeof code === 'string' && BOUNDED_ERROR_CODES.has(code as WorkforceWebMcpErrorCode)
    ? code as WorkforceWebMcpErrorCode
    : 'WORKFORCE_TOOL_EXECUTION_FAILED'
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown
  } catch {
    return null
  }
}

function makeTool(
  descriptor: WorkforceWebMcpDescriptor,
  endpoint: string,
  fetchImpl: typeof fetch,
  lifecycleSignal: AbortSignal,
): WebMcpTool {
  return {
    name: toWebMcpToolName(descriptor.id),
    description: `LiquidHR: ${descriptor.description} Alleen lezen binnen de huidige gebruikerscontext.`,
    inputSchema: descriptor.inputSchema,
    annotations: {
      readOnlyHint: true,
      untrustedContentHint: true,
      consequentialHint: false,
    },
    execute: async (input: unknown, context?: WebMcpExecutionContext): Promise<unknown> => {
      const signal = combineAbortSignals(lifecycleSignal, context?.signal)
      throwIfAborted(signal)
      if (!isRecord(input)
        || containsForbiddenContextKey(input)
        || !matchesJsonSchema(input, descriptor.inputSchema)) {
        throw new WorkforceWebMcpError('WORKFORCE_REQUEST_INVALID')
      }

      let body: string
      try {
        body = JSON.stringify({ toolId: descriptor.id, input })
      } catch {
        throw new WorkforceWebMcpError('WORKFORCE_REQUEST_INVALID')
      }

      let response: Response
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body,
          signal,
        })
      } catch {
        if (signal.aborted) throwIfAborted(signal)
        throw new WorkforceWebMcpError('WORKFORCE_TOOL_EXECUTION_FAILED')
      }

      throwIfAborted(signal)
      const payload = await readJson(response)
      if (!response.ok) throw new WorkforceWebMcpError(errorCodeFromPayload(payload))
      if (!isRecord(payload) || !Object.prototype.hasOwnProperty.call(payload, 'data')) {
        throw new WorkforceWebMcpError('WORKFORCE_TOOL_EXECUTION_FAILED')
      }
      return payload.data
    },
  }
}

function noOpRegistration(): WorkforceWebMcpRegistration {
  return {
    supported: false,
    registeredToolNames: [],
    cleanup: () => undefined,
  }
}

/**
 * Registers read-only Workforce tools when the browser exposes WebMCP.
 *
 * Registration is progressive enhancement: unsupported browsers return a
 * no-op handle. Aborting the returned lifecycle unregisters all registered
 * tools. Every invocation still travels through the authenticated BFF.
 */
export async function registerWorkforceWebMcp(
  options: RegisterWorkforceWebMcpOptions,
): Promise<WorkforceWebMcpRegistration> {
  const modelContext = options.modelContext === undefined ? getModelContext() : options.modelContext
  if (!modelContext) return noOpRegistration()

  const endpoint = normalizeEndpoint(options.endpoint ?? DEFAULT_ENDPOINT)
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') throw new WorkforceWebMcpError('WEBMCP_FETCH_UNAVAILABLE')

  const registrationController = new AbortController()
  const onLifecycleAbort = () => registrationController.abort()
  if (options.lifecycleSignal) {
    if (options.lifecycleSignal.aborted) registrationController.abort()
    else options.lifecycleSignal.addEventListener('abort', onLifecycleAbort, { once: true })
  }

  const registeredToolNames: string[] = []
  const descriptors = options.descriptors.filter((descriptor) =>
    descriptor.operation === 'READ'
    && descriptor.id.trim().length > 0
    && descriptor.description.trim().length > 0
    && isRecord(descriptor.inputSchema)
    && descriptor.inputSchema.type === 'object'
    && isSupportedInputSchema(descriptor.inputSchema)
    && !descriptorContainsForbiddenContextKey(descriptor.inputSchema),
  )

  try {
    for (const descriptor of descriptors) {
      if (registrationController.signal.aborted) break
      const tool = makeTool(descriptor, endpoint, fetchImpl, registrationController.signal)
      await modelContext.registerTool(tool, { signal: registrationController.signal })
      registeredToolNames.push(tool.name)
    }
  } catch (error) {
    registrationController.abort()
    if (options.lifecycleSignal) options.lifecycleSignal.removeEventListener('abort', onLifecycleAbort)
    throw error
  }

  let cleaned = false
  return {
    supported: true,
    registeredToolNames,
    cleanup: () => {
      if (cleaned) return
      cleaned = true
      registrationController.abort()
      if (options.lifecycleSignal) options.lifecycleSignal.removeEventListener('abort', onLifecycleAbort)
    },
  }
}
