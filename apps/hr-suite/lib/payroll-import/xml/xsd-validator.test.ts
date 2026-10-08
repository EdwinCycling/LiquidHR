import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { LOONAANGIFTE_2026_XSD_SHA256 } from './xsd-constants'
import { createOfficialLoonaangifte2026Validator } from './xsd-validator'

const schemaBytes = readFileSync(new URL('./schemas/Loonaangifte2026v2.0.xsd', import.meta.url))

describe('CONTROL02 officiële XSD-validator bootstrap', () => {
  it('blijft unavailable als de schema-asset ontbreekt', () => {
    expect(createOfficialLoonaangifte2026Validator(null)).toBeNull()
  })

  it('blijft unavailable als de schema-bytes niet exact het officiële schema zijn', () => {
    const alteredBytes = new TextEncoder().encode(`${schemaBytes.toString('utf8')} `)

    expect(createOfficialLoonaangifte2026Validator(alteredBytes)).toBeNull()
  })

  it('blijft unavailable als compilatie van het gepinde schema faalt', () => {
    const validatorFactory = vi.fn(() => {
      throw new Error('schema compilation failed')
    })

    expect(createOfficialLoonaangifte2026Validator(schemaBytes, validatorFactory)).toBeNull()
    expect(validatorFactory).toHaveBeenCalledOnce()
  })

  it('bouwt alleen de validator voor de asset met de vastgepinde officiële hash', () => {
    const validator = createOfficialLoonaangifte2026Validator(schemaBytes)

    expect(schemaBytes.byteLength).toBe(28_315)
    expect(LOONAANGIFTE_2026_XSD_SHA256).toMatch(/^[0-9a-f]{64}$/u)
    expect(createHash('sha256').update(schemaBytes).digest('hex')).toBe(LOONAANGIFTE_2026_XSD_SHA256)
    expect(validator).not.toBeNull()
    validator?.dispose()
  })
})
