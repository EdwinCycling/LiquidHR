import { z } from 'zod'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const evidenceStatus = z.enum(['NOT_PROVIDED', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'])

export const talentImportSourceRowSchema = z.object({
  employeeNumber: z.string().trim().min(1).max(80),
  capabilityCode: z.string().trim().min(1).max(80),
  validFrom: date,
  validUntil: date.nullable(),
  talentLevelCode: z.string().trim().max(80).nullable(),
  languageLevel: z.string().trim().max(20).nullable(),
  certificateCode: z.string().trim().max(160).nullable(),
  evidenceStatus: evidenceStatus.nullable(),
}).strict()

export const talentImportPreviewSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  content: z.string().min(1).max(1_000_000),
}).strict()

export const talentImportCommandSchema = z.object({
  command: z.enum(['COMMIT', 'ROLLBACK']),
  idempotencyKey: z.string().trim().min(16).max(120),
}).strict()

export type TalentImportSourceRow = z.infer<typeof talentImportSourceRowSchema>
export type TalentImportPreviewInput = z.infer<typeof talentImportPreviewSchema>
export type TalentImportCommandInput = z.infer<typeof talentImportCommandSchema>

export type ParsedTalentImport = {
  rows: Array<{ rowNumber: number; values: Record<string, string> }>
  errors: string[]
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1 } else quoted = !quoted
    } else if (character === ',' && !quoted) {
      values.push(value.trim())
      value = ''
    } else value += character
  }
  if (quoted) throw new Error('TALENT_IMPORT_UNCLOSED_QUOTE')
  values.push(value.trim())
  return values
}

export function parseTalentImportCsv(content: string): ParsedTalentImport {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return { rows: [], errors: ['TALENT_IMPORT_HEADER_OR_ROW_MISSING'] }
  let headers: string[]
  try { headers = parseCsvLine(lines[0]).map((header) => header.trim().toLocaleLowerCase('en-US')) } catch (error) { return { rows: [], errors: [error instanceof Error ? error.message : 'TALENT_IMPORT_HEADER_INVALID'] } }
  const requiredHeaders = ['employee_number', 'capability_code', 'valid_from', 'valid_until', 'talent_level_code', 'language_level', 'certificate_code', 'evidence_status']
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header))
  if (missingHeaders.length > 0) return { rows: [], errors: [`TALENT_IMPORT_HEADERS_MISSING:${missingHeaders.join(',')}`] }
  const errors: string[] = []
  const emptyValues = (): Record<string, string> => Object.fromEntries(headers.map((header) => [header, '']))
  const rows = lines.slice(1).map((line, index) => {
    try {
      const values = parseCsvLine(line)
      if (values.length !== headers.length) {
        errors.push(`TALENT_IMPORT_COLUMN_COUNT:${index + 2}`)
        return { rowNumber: index + 2, values: Object.fromEntries(headers.map((header, valueIndex) => [header, values[valueIndex] ?? ''])) }
      }
      return { rowNumber: index + 2, values: Object.fromEntries(headers.map((header, valueIndex) => [header, values[valueIndex] ?? ''])) }
    } catch (error) {
      errors.push(`${error instanceof Error ? error.message : 'TALENT_IMPORT_ROW_INVALID'}:${index + 2}`)
      return { rowNumber: index + 2, values: emptyValues() }
    }
  })
  return { rows, errors }
}
