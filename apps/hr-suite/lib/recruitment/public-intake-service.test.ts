import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))

import { RecruitmentError } from './errors'
import { createPublicIntakeProof, scanPublicDocument } from './public-intake-service'

const publicationId = '00000000-0000-0000-0000-000000000001'
const document = {
  bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]),
  mimeType: 'application/pdf',
  size: 8,
  fileName: 'cv.pdf',
}

describe('public intake security configuration boundaries', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('RECRUITMENT_RATE_LIMIT_PEPPER', 'a'.repeat(32))
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'turnstile-secret')
    vi.stubEnv('RECRUITMENT_MALWARE_SCAN_URL', '')
    vi.stubEnv('RECRUITMENT_MALWARE_SCAN_API_KEY', '')
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }))
    createAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: { accepted: true, proofId: 'proof-id', expiresAt: '2026-09-03T12:10:00.000Z' },
        error: null,
      }),
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('accepts documentless intake without malware scanner configuration', async () => {
    const claim = await createPublicIntakeProof({
      publicationId,
      challengeToken: 'turnstile-token',
      trustedClientIdentity: '203.0.113.42',
    })

    expect(claim.proofId).toBe('proof-id')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(createAdminClient).toHaveBeenCalledTimes(1)
  })

  it('fails closed when a document is submitted without malware scanner configuration', async () => {
    await expect(scanPublicDocument(document)).rejects.toMatchObject({
      code: 'RECRUITMENT_MALWARE_SCANNER_UNAVAILABLE',
      status: 503,
    } satisfies Partial<RecruitmentError>)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps Turnstile and pepper required for documentless intake', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    await expect(createPublicIntakeProof({ publicationId, challengeToken: 'turnstile-token', trustedClientIdentity: '203.0.113.42' })).rejects.toMatchObject({
      code: 'RECRUITMENT_BOT_CHALLENGE_UNAVAILABLE',
      status: 503,
    } satisfies Partial<RecruitmentError>)

    vi.stubEnv('TURNSTILE_SECRET_KEY', 'turnstile-secret')
    vi.stubEnv('RECRUITMENT_RATE_LIMIT_PEPPER', 'short')
    await expect(createPublicIntakeProof({ publicationId, challengeToken: 'turnstile-token', trustedClientIdentity: '203.0.113.42' })).rejects.toMatchObject({
      code: 'RECRUITMENT_PUBLIC_SECURITY_UNAVAILABLE',
      status: 503,
    } satisfies Partial<RecruitmentError>)
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})
