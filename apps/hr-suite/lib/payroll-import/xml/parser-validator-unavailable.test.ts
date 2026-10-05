import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./xsd-validator', () => ({
  validateOfficialLoonaangifte2026: vi.fn(() => 'UNAVAILABLE'),
}))

import { parseLoonaangifteXml } from './parser'

const fixture = readFileSync(new URL('./fixtures/loonaangifte-2026-v2.0.synthetic.xml', import.meta.url))
const identity = {
  protectBsn: (bsn: string): string => createHash('sha256').update(`test-only:${bsn}`).digest('hex'),
}

describe('CONTROL02 XSD fail-closed parser gate', () => {
  it('rejects an otherwise parseable source when official schema validation is unavailable', () => {
    const result = parseLoonaangifteXml({ bytes: fixture, context: { identity } })

    expect(result.status).toBe('REJECTED')
    expect(result.diagnostics[0]).toMatchObject({ code: 'XSD_UNAVAILABLE', severity: 'BLOCKING' })
    expect(JSON.stringify(result)).not.toContain('123456782')
  })
})
