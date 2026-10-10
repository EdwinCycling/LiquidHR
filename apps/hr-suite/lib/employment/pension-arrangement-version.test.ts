import { describe, expect, it } from 'vitest'
import { getPensionArrangementEstablishedFrom, resolvePensionArrangementVersion, type PensionArrangementVersionCandidate } from './pension-arrangement-version'

const arrangementId = 'a0000000-0000-4000-8000-000000000001'

function version(options: Partial<PensionArrangementVersionCandidate> & Pick<PensionArrangementVersionCandidate, 'id' | 'version_number' | 'effective_from'>): PensionArrangementVersionCandidate {
  return {
    id: options.id,
    pension_arrangement_id: options.pension_arrangement_id ?? arrangementId,
    version_number: options.version_number,
    effective_from: options.effective_from,
    effective_to: options.effective_to ?? null,
    is_active: options.is_active ?? true,
  }
}

describe('resolvePensionArrangementVersion', () => {
  it('retains the arrangement baseline date when a later successor is selected', () => {
    const versions = [
      version({ id: 'v1', version_number: 1, effective_from: '2023-01-01' }),
      version({ id: 'v2', version_number: 2, effective_from: '2026-01-01' }),
    ]

    expect(resolvePensionArrangementVersion(versions, arrangementId, '2026-10-01', '2026-10-31').selected?.id)
      .toBe('v2')
    expect(getPensionArrangementEstablishedFrom(versions, arrangementId)).toBe('2023-01-01')
  })

  it('fails closed when immutable baseline version metadata is missing or ambiguous', () => {
    expect(getPensionArrangementEstablishedFrom([
      version({ id: 'v2', version_number: 2, effective_from: '2026-01-01' }),
    ], arrangementId)).toBeNull()
    expect(getPensionArrangementEstablishedFrom([
      version({ id: 'v1a', version_number: 1, effective_from: '2023-01-01' }),
      version({ id: 'v1b', version_number: 1, effective_from: '2024-01-01' }),
    ], arrangementId)).toBeNull()
  })

  it('selects the latest explicit successor for the payroll period', () => {
    const result = resolvePensionArrangementVersion([
      version({ id: 'v1', version_number: 1, effective_from: '2018-01-01' }),
      version({ id: 'v2', version_number: 2, effective_from: '2026-01-01' }),
      version({ id: 'v3', version_number: 3, effective_from: '2026-11-01' }),
    ], arrangementId, '2026-10-01', '2026-10-31')

    expect(result).toMatchObject({ hasVersionHistory: true, selected: { id: 'v2' }, reasonCode: null })
  })

  it('does not silently revive an expired or inactive successor predecessor', () => {
    const expired = resolvePensionArrangementVersion([
      version({ id: 'v1', version_number: 1, effective_from: '2018-01-01' }),
      version({ id: 'v2', version_number: 2, effective_from: '2026-09-01', effective_to: '2026-09-30' }),
    ], arrangementId, '2026-10-01', '2026-10-31')
    const inactive = resolvePensionArrangementVersion([
      version({ id: 'v1', version_number: 1, effective_from: '2018-01-01' }),
      version({ id: 'v2', version_number: 2, effective_from: '2026-09-01', is_active: false }),
    ], arrangementId, '2026-10-01', '2026-10-31')

    expect(expired.selected?.id).toBe('v2')
    expect(expired.reasonCode).toBe('PENSION_ARRANGEMENT_NOT_ACTIVE')
    expect(inactive.selected?.id).toBe('v2')
    expect(inactive.reasonCode).toBe('PENSION_ARRANGEMENT_NOT_ACTIVE')
  })

  it('blocks a version change partway through a payroll period', () => {
    const result = resolvePensionArrangementVersion([
      version({ id: 'v1', version_number: 1, effective_from: '2018-01-01' }),
      version({ id: 'v2', version_number: 2, effective_from: '2026-10-15' }),
    ], arrangementId, '2026-10-01', '2026-10-31')

    expect(result.selected?.id).toBe('v1')
    expect(result.changeVersionIds).toEqual(['v2'])
    expect(result.reasonCode).toBe('PENSION_ARRANGEMENT_VERSION_CHANGE_WITHIN_PERIOD')
  })

  it('leaves legacy arrangements untouched until they have version history', () => {
    expect(resolvePensionArrangementVersion([], arrangementId, '2026-10-01', '2026-10-31'))
      .toMatchObject({ hasVersionHistory: false, selected: null, reasonCode: null })
  })
})
