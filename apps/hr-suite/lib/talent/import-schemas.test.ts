import { describe, expect, it } from 'vitest'
import { parseTalentImportCsv, talentImportCommandSchema, talentImportPreviewSchema } from './import-schemas'

describe('Talent import contracts', () => {
  it('parses the required CSV columns, including a BOM and quoted values', () => {
    const result = parseTalentImportCsv('\uFEFFemployee_number,capability_code,valid_from,valid_until,talent_level_code,language_level,certificate_code,evidence_status\n1001,LEADERSHIP,2026-08-01,,LEVEL-2,B2,"CERT,001",VERIFIED')

    expect(result.errors).toEqual([])
    expect(result.rows[0]?.rowNumber).toBe(2)
    expect(result.rows[0]?.values.certificate_code).toBe('CERT,001')
  })

  it('returns row-specific errors for malformed column counts and quotes', () => {
    const result = parseTalentImportCsv('employee_number,capability_code,valid_from,valid_until,talent_level_code,language_level,certificate_code,evidence_status\n1001,SKILL,2026-08-01\n1002,"SKILL,2026-08-01,,LEVEL-1,B1,,PENDING')

    expect(result.rows).toHaveLength(2)
    expect(result.errors).toEqual(['TALENT_IMPORT_COLUMN_COUNT:2', 'TALENT_IMPORT_UNCLOSED_QUOTE:3'])
  })

  it('requires explicit command idempotency and the preview payload shape', () => {
    expect(talentImportCommandSchema.safeParse({ command: 'COMMIT', idempotencyKey: 'commit-batch-123456' }).success).toBe(true)
    expect(talentImportCommandSchema.safeParse({ command: 'COMMIT', idempotencyKey: 'short' }).success).toBe(false)
    expect(talentImportPreviewSchema.safeParse({ filename: 'talent.csv', content: 'header\nrow' }).success).toBe(true)
  })
})
