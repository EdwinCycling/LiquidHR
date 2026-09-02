import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RecruitmentError } from '@/lib/recruitment/errors'

const mocks = vi.hoisted(() => ({
  getPublicVacancy: vi.fn(),
  getTrustedClientIdentity: vi.fn(),
  createPublicIntakeProof: vi.fn(),
  scanPublicDocument: vi.fn(),
  storePublicDocument: vi.fn(),
  submitPublicRecruitmentApplication: vi.fn(),
}))

vi.mock('@/lib/recruitment/public-repository', () => ({ getPublicVacancy: mocks.getPublicVacancy }))
vi.mock('@/lib/security/trusted-client-identity', () => ({ getTrustedClientIdentity: mocks.getTrustedClientIdentity }))
vi.mock('@/lib/recruitment/public-intake-service', () => ({
  createPublicIntakeProof: mocks.createPublicIntakeProof,
  scanPublicDocument: mocks.scanPublicDocument,
  storePublicDocument: mocks.storePublicDocument,
}))
vi.mock('@/lib/recruitment/application-service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/recruitment/application-service')>('@/lib/recruitment/application-service')
  return { ...actual, submitPublicRecruitmentApplication: mocks.submitPublicRecruitmentApplication }
})

import { POST } from './route'

const publicId = '00000000-0000-0000-0000-000000000001'
const slug = 'open-role'
const renderedAt = '2026-09-02T12:00:00.000Z'

function input(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '', motivation: '', answers: [],
    challengeToken: 'turnstile-token', honeypot: '', renderedAt, idempotencyKey: 'idempotency-12345678', ...overrides,
  }
}

function jsonRequest(value: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://example.test/api/public/recruitment', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(value),
  })
}

function params(): { params: Promise<{ publicId: string }> } {
  return { params: Promise.resolve({ publicId }) }
}

describe('public recruitment application route security order', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPublicVacancy.mockResolvedValue({ publicationId: publicId, slug, title: 'Open role', location: null, content: { formConfig: { cv: 'OPTIONAL' } } })
    mocks.getTrustedClientIdentity.mockReturnValue({ ok: true, kind: 'TRUSTED_VERCEL_CLIENT', identity: '203.0.113.42' })
    mocks.createPublicIntakeProof.mockResolvedValue({ proof: 'proof-value', bucketKeyHash: 'a'.repeat(64), proofId: 'proof-id', expiresAt: '2026-09-02T12:10:00.000Z' })
    mocks.scanPublicDocument.mockResolvedValue({ detectedType: 'PDF', reference: 'scan-1', checksumSha256: 'b'.repeat(64) })
    mocks.submitPublicRecruitmentApplication.mockResolvedValue('application-id')
    mocks.storePublicDocument.mockResolvedValue(undefined)
  })

  it('rejects a declared oversized request before parsing or external calls', async () => {
    const response = await POST(jsonRequest({ input: input(), slug }, { 'content-length': '4250001' }), params())
    expect(response.status).toBe(413)
    expect(mocks.getPublicVacancy).not.toHaveBeenCalled()
    expect(mocks.getTrustedClientIdentity).not.toHaveBeenCalled()
    expect(mocks.createPublicIntakeProof).not.toHaveBeenCalled()
    expect(mocks.scanPublicDocument).not.toHaveBeenCalled()
    expect(mocks.submitPublicRecruitmentApplication).not.toHaveBeenCalled()
    expect(mocks.storePublicDocument).not.toHaveBeenCalled()
  })

  it.each([
    ['required CV missing', { cv: 'REQUIRED' }, jsonRequest({ input: input(), slug })],
    ['hidden CV supplied', { cv: 'HIDDEN' }, (() => {
      const form = new FormData()
      for (const [key, value] of Object.entries(input())) form.set(key, String(value))
      form.set('slug', slug)
      form.set('cv', new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'cv.pdf', { type: 'application/pdf' }))
      return new Request('https://example.test/api/public/recruitment', { method: 'POST', body: form })
    })()],
  ])('rejects %s before identity and claim', async (_label, formConfig, request) => {
    mocks.getPublicVacancy.mockResolvedValue({ publicationId: publicId, slug, title: 'Open role', location: null, content: { formConfig } })
    const response = await POST(request, params())
    expect(response.status).toBe(422)
    expect(mocks.getTrustedClientIdentity).not.toHaveBeenCalled()
    expect(mocks.createPublicIntakeProof).not.toHaveBeenCalled()
  })

  it('fails closed on unavailable trusted identity before Turnstile, claim, scan or submit', async () => {
    mocks.getTrustedClientIdentity.mockReturnValue({ ok: false, kind: 'UNAVAILABLE', reason: 'MISSING_PROVENANCE' })
    const response = await POST(jsonRequest({ input: input(), slug }), params())
    expect(response.status).toBe(503)
    expect(mocks.createPublicIntakeProof).not.toHaveBeenCalled()
    expect(mocks.scanPublicDocument).not.toHaveBeenCalled()
    expect(mocks.submitPublicRecruitmentApplication).not.toHaveBeenCalled()
  })

  it('does not scan after a rejected claim and returns bounded retry metadata', async () => {
    mocks.createPublicIntakeProof.mockRejectedValue(new RecruitmentError('RECRUITMENT_PUBLIC_RATE_LIMITED', 429, 12))
    const response = await POST(jsonRequest({ input: input(), slug }), params())
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('12')
    expect(mocks.scanPublicDocument).not.toHaveBeenCalled()
    expect(mocks.submitPublicRecruitmentApplication).not.toHaveBeenCalled()
    expect(mocks.storePublicDocument).not.toHaveBeenCalled()
  })

  it('runs the accepted document flow in order and scans exactly once', async () => {
    const events: string[] = []
    mocks.getPublicVacancy.mockImplementation(async () => { events.push('vacancy'); return { publicationId: publicId, slug, title: 'Open role', location: null, content: { formConfig: { cv: 'OPTIONAL' } } } })
    mocks.getTrustedClientIdentity.mockImplementation(() => { events.push('identity'); return { ok: true, kind: 'TRUSTED_VERCEL_CLIENT', identity: '203.0.113.42' } })
    mocks.createPublicIntakeProof.mockImplementation(async () => { events.push('claim'); return { proof: 'proof-value', bucketKeyHash: 'a'.repeat(64), proofId: 'proof-id', expiresAt: '2026-09-02T12:10:00.000Z' } })
    mocks.scanPublicDocument.mockImplementation(async () => { events.push('scan'); return { detectedType: 'PDF', reference: 'scan-1', checksumSha256: 'b'.repeat(64) } })
    mocks.submitPublicRecruitmentApplication.mockImplementation(async () => { events.push('submit'); return 'application-id' })
    mocks.storePublicDocument.mockImplementation(async () => { events.push('store') })
    const form = new FormData()
    for (const [key, value] of Object.entries(input())) form.set(key, String(value))
    form.set('slug', slug)
    form.set('cv', new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'cv.pdf', { type: 'application/pdf' }))

    const response = await POST(new Request('https://example.test/api/public/recruitment', { method: 'POST', body: form }), params())
    expect(response.status).toBe(201)
    expect(events).toEqual(['vacancy', 'identity', 'claim', 'scan', 'submit', 'store'])
    expect(mocks.scanPublicDocument).toHaveBeenCalledTimes(1)
    expect(mocks.storePublicDocument).toHaveBeenCalledTimes(1)
  })

  it('accepts a normal application without invoking the scanner when no CV is supplied', async () => {
    const response = await POST(jsonRequest({ input: input(), slug }), params())
    expect(response.status).toBe(201)
    expect(mocks.createPublicIntakeProof).toHaveBeenCalledTimes(1)
    expect(mocks.scanPublicDocument).not.toHaveBeenCalled()
    expect(mocks.submitPublicRecruitmentApplication).toHaveBeenCalledTimes(1)
  })
})
