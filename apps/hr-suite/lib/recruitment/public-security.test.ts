import { describe, expect, it } from 'vitest'
import {
  createPublicIntakeKey,
  evaluatePublicUpload,
  validateRecruitmentDocument,
  type BotChallengeAdapter,
  type MalwareScannerAdapter,
} from './public-security'

const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])

describe('public recruitment security', () => {
  it('maakt alleen een gehashte rate-limitkey zonder rauwe kenmerken', async () => {
    const key = await createPublicIntakeKey({ networkAddress: '203.0.113.42', formFingerprint: 'browser-a' }, 'test-pepper')
    expect(key).toMatch(/^[a-f0-9]{64}$/)
    expect(key).not.toContain('203.0.113.42')
  })

  it('valideert grootte, MIME en magic bytes als één contract', () => {
    expect(validateRecruitmentDocument({ bytes: pdfHeader, mimeType: 'application/pdf', size: pdfHeader.byteLength, fileName: 'cv.pdf' })).toEqual({ ok: true, detectedType: 'PDF' })
    expect(validateRecruitmentDocument({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'application/pdf', size: 3, fileName: 'cv.pdf' })).toEqual({ ok: false, code: 'RECRUITMENT_DOCUMENT_SIGNATURE_INVALID' })
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
