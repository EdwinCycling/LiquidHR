import { describe, expect, it } from 'vitest'
import {
  createPublicIntakeKey,
  evaluatePublicUpload,
  PUBLIC_RECRUITMENT_DOCUMENT_MAX_BYTES,
  validateRecruitmentDocument,
  type BotChallengeAdapter,
  type MalwareScannerAdapter,
} from './public-security'

const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])

describe('public recruitment security', () => {
  it('maakt een stabiele publicatie- en clientgebonden HMAC zonder rauwe kenmerken', async () => {
    const input = { publicationId: '00000000-0000-0000-0000-000000000001', trustedClientIdentity: '203.0.113.42' }
    const pepper = '01234567890123456789012345678901'
    const key = await createPublicIntakeKey(input, pepper)
    expect(key).toBe('85d4df61b8bd5e76515274d117eb8f329ab274acf4eef875bcec470a47c685aa')
    expect(key).toBe(await createPublicIntakeKey(input, pepper))
    expect(key).not.toContain(input.trustedClientIdentity)
    expect(key).not.toBe(await createPublicIntakeKey({ ...input, publicationId: '00000000-0000-0000-0000-000000000002' }, pepper))
    expect(key).not.toBe(await createPublicIntakeKey({ ...input, trustedClientIdentity: '198.51.100.7' }, pepper))
    const firstRotation = { ...input, email: 'first@example.invalid', idempotencyKey: 'first' }
    const secondRotation = { ...input, email: 'second@example.invalid', idempotencyKey: 'second' }
    expect(key).toBe(await createPublicIntakeKey(firstRotation, pepper))
    expect(key).toBe(await createPublicIntakeKey(secondRotation, pepper))
    await expect(createPublicIntakeKey(input, 'short')).rejects.toThrow('RECRUITMENT_RATE_LIMIT_PEPPER_INVALID')
  })

  it('valideert grootte, MIME en magic bytes als één contract', () => {
    expect(validateRecruitmentDocument({ bytes: pdfHeader, mimeType: 'application/pdf', size: pdfHeader.byteLength, fileName: 'cv.pdf' })).toEqual({ ok: true, detectedType: 'PDF' })
    expect(validateRecruitmentDocument({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'application/pdf', size: 3, fileName: 'cv.pdf' })).toEqual({ ok: false, code: 'RECRUITMENT_DOCUMENT_SIGNATURE_INVALID' })
  })

  it('handhaaft de publieke documentgrens exact en laat de interne default intact', () => {
    const atLimit = new Uint8Array(PUBLIC_RECRUITMENT_DOCUMENT_MAX_BYTES)
    atLimit.set(pdfHeader)
    expect(validateRecruitmentDocument({ bytes: atLimit, mimeType: 'application/pdf', size: atLimit.byteLength, fileName: 'cv.pdf' }, { maxBytes: PUBLIC_RECRUITMENT_DOCUMENT_MAX_BYTES })).toEqual({ ok: true, detectedType: 'PDF' })
    const aboveLimit = new Uint8Array(PUBLIC_RECRUITMENT_DOCUMENT_MAX_BYTES + 1)
    aboveLimit.set(pdfHeader)
    expect(validateRecruitmentDocument({ bytes: aboveLimit, mimeType: 'application/pdf', size: aboveLimit.byteLength, fileName: 'cv.pdf' }, { maxBytes: PUBLIC_RECRUITMENT_DOCUMENT_MAX_BYTES })).toEqual({ ok: false, code: 'RECRUITMENT_DOCUMENT_SIZE_INVALID' })
    expect(validateRecruitmentDocument({ bytes: aboveLimit, mimeType: 'application/pdf', size: aboveLimit.byteLength, fileName: 'cv.pdf' })).toEqual({ ok: true, detectedType: 'PDF' })
  })

  it('herkent DOCX alleen met passende MIME en extensie', () => {
    const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    expect(validateRecruitmentDocument({ bytes: docx, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: docx.byteLength, fileName: 'cv.docx' }, { maxBytes: PUBLIC_RECRUITMENT_DOCUMENT_MAX_BYTES })).toEqual({ ok: true, detectedType: 'DOCX' })
    expect(validateRecruitmentDocument({ bytes: docx, mimeType: 'application/pdf', size: docx.byteLength, fileName: 'cv.pdf' }, { maxBytes: PUBLIC_RECRUITMENT_DOCUMENT_MAX_BYTES })).toEqual({ ok: false, code: 'RECRUITMENT_DOCUMENT_SIGNATURE_INVALID' })
  })

  it('faalt gesloten zonder bot- of scannerbewijs', async () => {
    const unavailableBot: BotChallengeAdapter = { verify: async () => ({ ok: false, code: 'RECRUITMENT_BOT_CHALLENGE_UNAVAILABLE' }) }
    const unavailableScanner: MalwareScannerAdapter = { scan: async () => ({ status: 'UNAVAILABLE' }) }
    await expect(evaluatePublicUpload({ token: 'token', document: { bytes: pdfHeader, mimeType: 'application/pdf', size: pdfHeader.byteLength, fileName: 'cv.pdf' } }, { bot: unavailableBot, scanner: unavailableScanner })).resolves.toEqual({ ok: false, code: 'RECRUITMENT_BOT_CHALLENGE_UNAVAILABLE' })
  })

  it('accepteert alleen een expliciete CLEAN scannerscore', async () => {
    const bot: BotChallengeAdapter = { verify: async () => ({ ok: true }) }
    const scanner: MalwareScannerAdapter = { scan: async () => ({ status: 'CLEAN', reference: 'scan-1' }) }
    await expect(evaluatePublicUpload({ token: 'token', document: { bytes: pdfHeader, mimeType: 'application/pdf', size: pdfHeader.byteLength, fileName: 'cv.pdf' } }, { bot, scanner })).resolves.toEqual({ ok: true, scanReference: 'scan-1', detectedType: 'PDF' })
  })
})
