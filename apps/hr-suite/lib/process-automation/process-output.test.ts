import { describe, expect, it } from 'vitest'
import {
  buildProcessOutputHtml,
  buildProcessOutputPdf,
  databaseUuidSchema,
  processOutputFilename,
  processOutputStorageKey,
  sha256Hex,
  type ProcessOutputSource,
} from './process-output'

const source: ProcessOutputSource = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  hrGroupId: '22222222-2222-4222-8222-222222222222',
  administrationId: '33333333-3333-4333-8333-333333333333',
  processInstanceId: '44444444-4444-4444-8444-444444444444',
  processVersionId: '55555555-5555-4555-8555-555555555555',
  subjectEmployeeId: '66666666-6666-4666-8666-666666666666',
  outputKey: 'transfer-summary',
  title: { nl: 'Overplaatsing & samenvatting', en: 'Transfer summary' },
  outputFormat: 'PDF',
  dossierCategoryKey: 'GENERAL',
  language: 'nl',
  fieldValues: [
    { key: 'reason', label: { nl: 'Reden', en: 'Reason' }, value: '<script>alert(1)</script>' },
    { key: 'amount', label: { nl: 'Bedrag', en: 'Amount' }, value: 12.5 },
  ],
}

describe('process output generation', () => {
  it('escapes field values in the HTML summary', () => {
    const html = buildProcessOutputHtml(source)
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it('creates a stable PDF and checksum for the same source', () => {
    const first = buildProcessOutputPdf(source)
    const second = buildProcessOutputPdf(source)
    expect(first).toEqual(second)
    expect(new TextDecoder().decode(first.slice(0, 8))).toBe('%PDF-1.4')
    expect(sha256Hex(first)).toMatch(/^[a-f0-9]{64}$/)
  })

  it('uses deterministic dossier paths and safe filenames', () => {
    expect(processOutputFilename(source)).toBe('transfer-summary.pdf')
    expect(processOutputStorageKey(source, '77777777-7777-4777-8777-777777777777')).toBe(
      '11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333/66666666-6666-4666-8666-666666666666/process-output/77777777-7777-4777-8777-777777777777.pdf',
    )
  })

  it('accepteert geldige PostgreSQL UUID-vormen zonder RFC-versiebeperking', () => {
    expect(databaseUuidSchema.safeParse('8483abc9-f275-c80b-5a23-fedc54ce9f0a').success).toBe(true)
    expect(databaseUuidSchema.safeParse('geen-uuid').success).toBe(false)
  })
})
