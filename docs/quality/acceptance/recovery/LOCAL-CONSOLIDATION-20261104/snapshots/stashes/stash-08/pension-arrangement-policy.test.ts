import { describe, expect, it } from 'vitest'
import {
  isSyntheticPensionFixtureEnabled,
  SYNTHETIC_PENSION_FIXTURE_CLAIM,
  SYNTHETIC_PENSION_FIXTURE_ENVIRONMENT_CLAIM,
  SYNTHETIC_PENSION_FIXTURE_FLAG,
  syntheticPensionSourceClassification,
} from './pension-arrangement-policy'

const authorizedTestMetadata = {
  [SYNTHETIC_PENSION_FIXTURE_CLAIM]: true,
  [SYNTHETIC_PENSION_FIXTURE_ENVIRONMENT_CLAIM]: 'test',
}

describe('synthetic pension fixture policy', () => {
  it('requires the explicit runtime flag and trusted app-metadata claims', () => {
    expect(isSyntheticPensionFixtureEnabled({ LIQUIDHR_RUNTIME_ENV: 'test' }, authorizedTestMetadata)).toBe(false)
    expect(isSyntheticPensionFixtureEnabled({
      [SYNTHETIC_PENSION_FIXTURE_FLAG]: 'true', LIQUIDHR_RUNTIME_ENV: 'test',
    })).toBe(false)
    expect(isSyntheticPensionFixtureEnabled({
      [SYNTHETIC_PENSION_FIXTURE_FLAG]: 'true', LIQUIDHR_RUNTIME_ENV: 'test',
    }, { ...authorizedTestMetadata, [SYNTHETIC_PENSION_FIXTURE_ENVIRONMENT_CLAIM]: 'development' })).toBe(false)
    expect(isSyntheticPensionFixtureEnabled({
      [SYNTHETIC_PENSION_FIXTURE_FLAG]: 'true', LIQUIDHR_RUNTIME_ENV: 'test',
    }, { user_metadata: authorizedTestMetadata })).toBe(false)
  })

  it.each([
    ['test', 'test'],
    ['development', 'development'],
    ['preview', 'preview'],
  ])('allows an explicitly enabled %s environment only with its matching trusted claim', (runtime, claim) => {
    expect(isSyntheticPensionFixtureEnabled({
      [SYNTHETIC_PENSION_FIXTURE_FLAG]: 'true', LIQUIDHR_RUNTIME_ENV: runtime,
    }, {
      [SYNTHETIC_PENSION_FIXTURE_CLAIM]: true,
      [SYNTHETIC_PENSION_FIXTURE_ENVIRONMENT_CLAIM]: claim,
    })).toBe(true)
  })

  it('allows a non-production Vercel Preview build while NODE_ENV is production', () => {
    expect(isSyntheticPensionFixtureEnabled({
      [SYNTHETIC_PENSION_FIXTURE_FLAG]: 'true',
      VERCEL_ENV: 'preview',
      NODE_ENV: 'production',
    }, {
      [SYNTHETIC_PENSION_FIXTURE_CLAIM]: true,
      [SYNTHETIC_PENSION_FIXTURE_ENVIRONMENT_CLAIM]: 'preview',
    })).toBe(true)
  })

  it('blocks production even when the runtime flag and trusted claim are present', () => {
    expect(isSyntheticPensionFixtureEnabled({
      [SYNTHETIC_PENSION_FIXTURE_FLAG]: 'true',
      LIQUIDHR_RUNTIME_ENV: 'test',
      VERCEL_ENV: 'production',
      NODE_ENV: 'production',
    }, authorizedTestMetadata)).toBe(false)
  })

  it('validates and labels synthetic scenarios without accepting control characters', () => {
    expect(syntheticPensionSourceClassification('PAY-RULE-002 — Frits PFZW 2026'))
      .toBe('SYNTHETIC_TEST_FIXTURE — PAY-RULE-002 — Frits PFZW 2026')
    expect(syntheticPensionSourceClassification('  ')).toBeNull()
    expect(syntheticPensionSourceClassification(`case\n${'x'.repeat(8)}`)).toBeNull()
  })
})
