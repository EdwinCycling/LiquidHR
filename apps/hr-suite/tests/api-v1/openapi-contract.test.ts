import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api-v1/core/errors'
import { API_NO_STORE_VALUE } from '@/lib/api-v1/core/responses'
import {
  API_RATE_LIMIT_MAX_RETRY_AFTER_SECONDS,
  API_RATE_LIMIT_MIN_RETRY_AFTER_SECONDS,
} from '@/lib/api-v1/security/rate-limit-response'

interface YamlParser {
  load(input: string): unknown
}

interface RecordValue {
  readonly [key: string]: unknown
}

const yaml = createRequire(import.meta.url)('js-yaml') as unknown as YamlParser
const draftPath = new URL('../../../../docs/AA/APIAI-01-OPENAPI-DRAFT-20261003.yaml', import.meta.url)
const draft = asRecord(
  yaml.load(readFileSync(draftPath, 'utf8')),
  'OpenAPI draft',
)

const CANDIDATE_DRAFT_PATHS = [
  '/api/v1/development-plans',
  '/api/v1/workforce/summary',
] as const

function asRecord(value: unknown, label: string): RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as RecordValue
}

function childRecord(parent: RecordValue, key: string, label: string): RecordValue {
  return asRecord(parent[key], `${label}.${key}`)
}

function propertyKeys(schema: RecordValue, label: string): string[] {
  return Object.keys(childRecord(schema, 'properties', label)).sort()
}

function expectObjectSchema(schema: RecordValue, expectedProperties: readonly string[], label: string): void {
  expect(schema.type, `${label}.type`).toBe('object')
  expect(schema.additionalProperties, `${label}.additionalProperties`).toBe(false)
  expect(propertyKeys(schema, label), `${label}.properties`).toEqual([...expectedProperties].sort())
}

function operationFor(pathname: string): RecordValue {
  const paths = childRecord(draft, 'paths', 'OpenAPI draft')
  return childRecord(childRecord(paths, pathname, 'OpenAPI draft.paths'), 'get', `${pathname}`)
}

function responseFor(operation: RecordValue, status: string, pathname: string): RecordValue {
  const responses = childRecord(operation, 'responses', `${pathname}.get`)
  return childRecord(responses, status, `${pathname}.get.responses`)
}

function jsonSchemaFor(response: RecordValue, label: string): RecordValue {
  const content = childRecord(response, 'content', label)
  const json = childRecord(content, 'application/json', `${label}.content`)
  return childRecord(json, 'schema', `${label}.content.application/json`)
}

function expectApiErrorReference(response: RecordValue, label: string): void {
  expect(response.$ref, `${label}.$ref`).toBeUndefined()
  expect(jsonSchemaFor(response, label).$ref, `${label}.schema.$ref`)
    .toBe('#/components/schemas/ApiError')
}

describe('APIAI-01 OpenAPI draft contract (not published)', () => {
  it('keeps publication status, servers and candidate paths explicit', () => {
    expect(draft.servers).toEqual([])
    expect(childRecord(draft, 'info', 'OpenAPI draft')['x-implementation-status'])
      .toBe('NOT-PUBLISHED')

    const paths = childRecord(draft, 'paths', 'OpenAPI draft')
    expect(Object.keys(paths).sort()).toEqual([...CANDIDATE_DRAFT_PATHS].sort())
  })

  it('declares GET operations without query parameters or request bodies', () => {
    const paths = childRecord(draft, 'paths', 'OpenAPI draft')

    for (const pathname of CANDIDATE_DRAFT_PATHS) {
      const pathItem = childRecord(paths, pathname, 'OpenAPI draft.paths')
      const operation = operationFor(pathname)

      expect(pathItem.parameters, `${pathname}.parameters`).toBeUndefined()
      expect(Object.keys(pathItem), `${pathname} path-item keys`).toEqual(['get'])
      expect(operation.parameters, `${pathname}.get.parameters`).toEqual([])
      expect(operation.requestBody, `${pathname}.get.requestBody`).toBeUndefined()
    }
  })

  it('exposes only the explicitly approved projected fields', () => {
    const workforce = operationFor('/api/v1/workforce/summary')
    const workforceResponse = jsonSchemaFor(
      responseFor(workforce, '200', '/api/v1/workforce/summary'),
      '/api/v1/workforce/summary.get.responses.200',
    )
    expectObjectSchema(workforceResponse, ['data', 'requestId'], 'workforce response')
    expectObjectSchema(
      childRecord(childRecord(workforceResponse, 'properties', 'workforce response'), 'data', 'workforce response.properties'),
      ['asOfDate'],
      'workforce data',
    )

    const plans = operationFor('/api/v1/development-plans')
    const plansResponse = jsonSchemaFor(
      responseFor(plans, '200', '/api/v1/development-plans'),
      '/api/v1/development-plans.get.responses.200',
    )
    expectObjectSchema(plansResponse, ['data', 'requestId'], 'development-plans response')

    const plansData = childRecord(
      childRecord(plansResponse, 'properties', 'development-plans response'),
      'data',
      'development-plans response.properties',
    )
    expect(plansData.type, 'development-plans data.type').toBe('array')
    const planItem = childRecord(plansData, 'items', 'development-plans data')
    expectObjectSchema(
      planItem,
      ['completedAt', 'periodEnd', 'periodStart', 'progressPercent', 'status'],
      'development-plan item',
    )
    expect(planItem.required, 'development-plan item.required')
      .toEqual(['periodStart', 'periodEnd', 'progressPercent', 'status', 'completedAt'])
    const status = childRecord(childRecord(planItem, 'properties', 'development-plan item'), 'status', 'development-plan item.properties')
    expect(status.type, 'development-plan status.type').toBe('string')
    expect(status.enum, 'development-plan status.enum').toBeUndefined()
  })

  it('documents no-store and request/correlation IDs for successful responses', () => {
    for (const pathname of CANDIDATE_DRAFT_PATHS) {
      const response = responseFor(operationFor(pathname), '200', pathname)
      const headers = childRecord(response, 'headers', `${pathname}.get.responses.200`)
      const cacheControl = childRecord(headers, 'Cache-Control', `${pathname}.get.responses.200.headers`)
      expect(childRecord(cacheControl, 'schema', 'Cache-Control').const).toBe(API_NO_STORE_VALUE)
      for (const headerName of ['X-Request-Id', 'X-Correlation-Id']) {
        const header = childRecord(headers, headerName, `${pathname}.get.responses.200.headers`)
        const schema = childRecord(header, 'schema', `${pathname}.get.responses.200.headers.${headerName}`)
        expect(schema.type, headerName).toBe('string')
        expect(schema.format, headerName).toBe('uuid')
      }
    }
  })

  it('uses the typed error envelope, no-store headers and bounded Retry-After', () => {
    const components = childRecord(draft, 'components', 'OpenAPI draft')
    const responses = childRecord(components, 'responses', 'OpenAPI draft.components')
    const schemas = childRecord(components, 'schemas', 'OpenAPI draft.components')
    const apiError = childRecord(schemas, 'ApiError', 'OpenAPI draft.components.schemas')

    expectObjectSchema(apiError, ['error'], 'ApiError')
    expect(apiError.required, 'ApiError.required').toEqual(['error'])
    const error = childRecord(childRecord(apiError, 'properties', 'ApiError'), 'error', 'ApiError.properties')
    expectObjectSchema(error, ['code', 'requestId'], 'ApiError.error')
    expect(error.required, 'ApiError.error.required').toEqual(['code', 'requestId'])

    const componentContracts = [
      ['InvalidRequest', '400', 'INVALID_REQUEST'],
      ['Unauthorized', '401', 'UNAUTHORIZED'],
      ['Forbidden', '403', 'FORBIDDEN'],
      ['NotFound', '404', 'NOT_FOUND'],
      ['MethodNotAllowed', '405', 'METHOD_NOT_ALLOWED'],
      ['RequestTooLarge', '413', 'REQUEST_TOO_LARGE'],
      ['RateLimited', '429', 'RATE_LIMITED'],
      ['InternalError', '500', 'INTERNAL_ERROR'],
      ['Unavailable', '503', 'SERVICE_UNAVAILABLE'],
    ] as const
    expect(Object.keys(responses).sort()).toEqual(componentContracts.map(([name]) => name).sort())

    for (const [name, status, code] of componentContracts) {
      const response = childRecord(responses, name, 'OpenAPI draft.components.responses')
      const headers = childRecord(response, 'headers', `${name} response`)
      const cacheControl = childRecord(headers, 'Cache-Control', `${name} response.headers`)
      const cacheSchema = childRecord(cacheControl, 'schema', `${name} response.headers.Cache-Control`)

      expect(cacheSchema.const, `${name} Cache-Control`).toBe(API_NO_STORE_VALUE)
      for (const headerName of ['X-Request-Id', 'X-Correlation-Id']) {
        const header = childRecord(headers, headerName, `${name} response.headers`)
        const schema = childRecord(header, 'schema', `${name} response.headers.${headerName}`)
        expect(schema.type, `${name} ${headerName}.type`).toBe('string')
        expect(schema.format, `${name} ${headerName}.format`).toBe('uuid')
      }
      expectApiErrorReference(response, `${name} response`)
      expect(new ApiError(code).status, `${name} status`).toBe(Number(status))

      if (name === 'RateLimited') {
        const retryAfter = childRecord(headers, 'Retry-After', `${name} response.headers`)
        const retrySchema = childRecord(retryAfter, 'schema', `${name} response.headers.Retry-After`)
        expect(retrySchema.type, 'Retry-After.type').toBe('integer')
        expect(retrySchema.minimum, 'Retry-After.minimum').toBe(API_RATE_LIMIT_MIN_RETRY_AFTER_SECONDS)
        expect(retrySchema.maximum, 'Retry-After.maximum').toBe(API_RATE_LIMIT_MAX_RETRY_AFTER_SECONDS)
      } else if (name === 'MethodNotAllowed') {
        const allow = childRecord(headers, 'Allow', `${name} response.headers`)
        expect(childRecord(allow, 'schema', `${name} response.headers.Allow`).const)
          .toBe('GET')
        expect(headers['Retry-After'], `${name} Retry-After`).toBeUndefined()
      } else {
        expect(headers['Retry-After'], `${name} Retry-After`).toBeUndefined()
      }
    }

    const operationErrorResponses = [
      ['400', 'InvalidRequest'],
      ['401', 'Unauthorized'],
      ['403', 'Forbidden'],
      ['404', 'NotFound'],
      ['405', 'MethodNotAllowed'],
      ['413', 'RequestTooLarge'],
      ['429', 'RateLimited'],
      ['500', 'InternalError'],
      ['503', 'Unavailable'],
    ] as const
    for (const pathname of CANDIDATE_DRAFT_PATHS) {
      const operation = operationFor(pathname)
      expect(Object.keys(childRecord(operation, 'responses', `${pathname}.get`)).sort())
        .toEqual(['200', ...operationErrorResponses.map(([status]) => status)].sort())
      for (const [status, responseName] of operationErrorResponses) {
        const response = responseFor(operation, status, pathname)
        expect(response.$ref, `${pathname}.${status}.$ref`)
          .toBe(`#/components/responses/${responseName}`)
      }
    }
  })
})
