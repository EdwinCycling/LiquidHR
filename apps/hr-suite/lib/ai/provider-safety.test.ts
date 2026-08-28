import { describe, expect, it, vi } from 'vitest'
import { AiExecutionError } from './contracts'
import {
  InMemoryProviderSafety,
  SupabaseProviderSafety,
  TEST_PROVIDER_SAFETY_DEFAULTS,
  resolveProviderSafetyConfig,
  type ProviderSafetyRpcClient,
  type ProviderSafetyClock,
} from './provider-safety'

vi.mock('server-only', () => ({}))

const input = (invocationId: string, overrides: Partial<{
  inputSizeCharacters: number
  featureMaxInputCharacters: number
  requestedOutputTokens: number
}> = {}) => ({
  invocationId,
  scope: { tenantId: 'tenant-1', hrGroupId: 'group-1', administrationId: null },
  actorUserId: 'actor-1',
  inputSizeCharacters: overrides.inputSizeCharacters ?? 100,
  featureMaxInputCharacters: overrides.featureMaxInputCharacters ?? 1000,
  requestedOutputTokens: overrides.requestedOutputTokens ?? 100,
})

function clock(start = '2026-08-28T12:34:00.000Z'): ProviderSafetyClock & { advance(milliseconds: number): void } {
  let current = new Date(start)
  return {
    now: () => new Date(current),
    advance: (milliseconds: number) => { current = new Date(current.valueOf() + milliseconds) },
  }
}

describe('provider safety configuration', () => {
  it('geeft vaste TEST-defaults en accepteert geen ontbrekende production safety config', () => {
    expect(resolveProviderSafetyConfig({ NODE_ENV: 'test' }, 'TEST')).toMatchObject({
      environment: 'test',
      enabled: true,
      ...TEST_PROVIDER_SAFETY_DEFAULTS,
    })
    expect(() => resolveProviderSafetyConfig({ NODE_ENV: 'production', AI_PROVIDER_ENABLED: 'true' }, 'OPENAI'))
      .toThrowError(expect.objectContaining({ code: 'AI_PROVIDER_SAFETY_UNAVAILABLE' }))
  })

  it('vereist expliciete production limits wanneer de provider wordt enabled', () => {
    expect(resolveProviderSafetyConfig({
      NODE_ENV: 'production',
      AI_PROVIDER_ENABLED: 'true',
      AI_PROVIDER_MAX_CALLS_PER_HOUR: '5',
      AI_PROVIDER_MAX_CALLS_PER_DAY: '20',
      AI_PROVIDER_MAX_CONCURRENT: '2',
      AI_PROVIDER_GLOBAL_MAX_OUTPUT_TOKENS: '4096',
      AI_PROVIDER_GLOBAL_MAX_INPUT_CHARACTERS: '16000',
      AI_PROVIDER_LEASE_SECONDS: '120',
    }, 'OPENAI')).toMatchObject({ environment: 'production', enabled: true, maxCallsPerHour: 5 })
  })

  it('behoudt een expliciete kill switch als typed block', async () => {
    const safety = new InMemoryProviderSafety({
      environment: 'production',
      enabled: false,
      ...TEST_PROVIDER_SAFETY_DEFAULTS,
    }, clock())

    await expect(safety.reserve(input('disabled'))).rejects.toMatchObject({
      code: 'AI_PROVIDER_DISABLED',
    })
  })
})

describe('in-memory provider safety seam', () => {
  it('laat 4/5 hourly toe en blokkeert 5/5 globaal', async () => {
    const safety = new InMemoryProviderSafety({ ...TEST_PROVIDER_SAFETY_DEFAULTS, environment: 'test', enabled: true, maxConcurrent: 5 }, clock())
    for (let index = 0; index < 4; index += 1) {
      const lease = await safety.reserve(input(`hour-${index}`))
      await safety.complete(lease)
    }
    await expect(safety.reserve(input('hour-blocked'))).resolves.toBeDefined()
    await expect(safety.reserve(input('hour-six'))).rejects.toMatchObject({ code: 'AI_PROVIDER_HOURLY_LIMIT' })
  })

  it('blokkeert daily 20/20 en concurrency 2/2', async () => {
    const testClock = clock()
    const safety = new InMemoryProviderSafety({ environment: 'test', enabled: true, ...TEST_PROVIDER_SAFETY_DEFAULTS }, testClock)
    const leases = await Promise.all([safety.reserve(input('concurrent-1')), safety.reserve(input('concurrent-2'))])
    await expect(safety.reserve(input('concurrent-blocked'))).rejects.toMatchObject({ code: 'AI_PROVIDER_CONCURRENCY_LIMIT' })
    await safety.complete(leases[0])
    await expect(safety.reserve(input('concurrent-3'))).resolves.toBeDefined()
  })

  it('negeert stale leases voor concurrency maar telt ze wel voor volume', async () => {
    const testClock = clock()
    const safety = new InMemoryProviderSafety({ ...TEST_PROVIDER_SAFETY_DEFAULTS, environment: 'test', enabled: true, maxConcurrent: 1 }, testClock)
    await safety.reserve(input('stale'))
    testClock.advance(121_000)
    await expect(safety.reserve(input('after-expiry'))).resolves.toBeDefined()
  })

  it('blokkeert dezelfde invocation opnieuw en nieuwe invocations na de globale cap', async () => {
    const safety = new InMemoryProviderSafety({ ...TEST_PROVIDER_SAFETY_DEFAULTS, environment: 'test', enabled: true, maxCallsPerHour: 2, maxCallsPerDay: 20, maxConcurrent: 2 }, clock())
    const first = await safety.reserve(input('same-invocation'))
    await expect(safety.reserve(input('same-invocation'))).rejects.toMatchObject({ code: 'AI_PROVIDER_INVOCATION_LIMIT' })
    await safety.complete(first)
    await safety.reserve(input('new-invocation'))
    await expect(safety.reserve(input('new-invocation-2'))).rejects.toMatchObject({ code: 'AI_PROVIDER_HOURLY_LIMIT' })
  })

  it('blokkeert input en output vóór provider execution', async () => {
    const safety = new InMemoryProviderSafety({ environment: 'test', enabled: true, ...TEST_PROVIDER_SAFETY_DEFAULTS }, clock())
    await expect(safety.reserve(input('large-input', { inputSizeCharacters: 16_001 }))).rejects.toMatchObject({ code: 'AI_PROVIDER_INPUT_TOO_LARGE' })
    await expect(safety.reserve(input('large-output', { requestedOutputTokens: 4097 }))).rejects.toMatchObject({ code: 'AI_PROVIDER_OUTPUT_TOO_LARGE' })
  })

  it('failt closed op corrupte limiterconfiguratie', () => {
    expect(() => new InMemoryProviderSafety({ ...TEST_PROVIDER_SAFETY_DEFAULTS, environment: 'test', enabled: true, maxCallsPerHour: 0 }, clock()))
      .toThrowError(expect.objectContaining({ code: 'AI_PROVIDER_SAFETY_UNAVAILABLE' }))
  })

  it('geeft alleen de typed safety errorcode door', async () => {
    const safety = new InMemoryProviderSafety({ environment: 'test', enabled: true, ...TEST_PROVIDER_SAFETY_DEFAULTS }, clock())
    await expect(safety.reserve(input('bad', { inputSizeCharacters: -1 }))).rejects.toBeInstanceOf(AiExecutionError)
  })

  it('mapt een toegestane RPC-lease en faalt gesloten op RPC-errors', async () => {
    const calls: string[] = []
    const client = {
      rpc: async (name: string) => {
        calls.push(name)
        if (name === 'reserve_ai_provider_execution') return {
          data: [{ allowed: true, block_reason: null, lease_id: 'lease-1', invocation_id: 'rpc-invocation', environment: 'test', counted_at: '2026-08-28T12:00:00.000Z', expires_at: '2026-08-28T12:02:00.000Z' }],
          error: null,
        }
        return { data: null, error: null }
      },
    } as unknown as ProviderSafetyRpcClient
    const safety = new SupabaseProviderSafety({ environment: 'test', enabled: true, ...TEST_PROVIDER_SAFETY_DEFAULTS }, client)
    const lease = await safety.reserve(input('rpc-invocation'))
    await safety.complete(lease)
    expect(lease.leaseId).toBe('lease-1')
    expect(calls).toEqual(['reserve_ai_provider_execution', 'complete_ai_provider_execution'])

    const failingClient = {
      rpc: async () => ({ data: null, error: { code: 'P0001', message: 'unavailable' } }),
    } as unknown as ProviderSafetyRpcClient
    await expect(new SupabaseProviderSafety({ environment: 'test', enabled: true, ...TEST_PROVIDER_SAFETY_DEFAULTS }, failingClient).reserve(input('rpc-fails')))
      .rejects.toMatchObject({ code: 'AI_PROVIDER_SAFETY_UNAVAILABLE' })
  })
})
