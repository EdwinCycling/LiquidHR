import { describe, expect, it } from 'vitest'
import { isExactGeneratedVercelConfig, unexpectedChangesAfterVerifiedVercelConfig } from './build-source-attestation.mjs'

const committed = JSON.stringify({
  framework: 'nextjs', git: { deploymentEnabled: false },
  installCommand: 'npm ci', crons: [{ path: '/api/cron/recruitment-retention', schedule: '0 3 * * *' }],
})
const generated = JSON.stringify({
  crons: [{ schedule: '0 3 * * *', path: '/api/cron/recruitment-retention' }],
  installCommand: 'npm ci', git: { deploymentEnabled: false }, framework: 'nextjs',
})

describe('strict Vercel-generated root config verification', () => {
  it('accepts identical JSON structure despite key formatting/order', () => {
    expect(isExactGeneratedVercelConfig(generated, committed)).toBe(true)
    expect(unexpectedChangesAfterVerifiedVercelConfig(['?? vercel.json', ' D .artifacts/x'], true)).toEqual([' D .artifacts/x'])
  })

  it('rejects changed, extended, invalid, and non-object config', () => {
    expect(isExactGeneratedVercelConfig(JSON.stringify({ ...JSON.parse(generated), installCommand: 'npm install' }), committed)).toBe(false)
    expect(isExactGeneratedVercelConfig(JSON.stringify({ ...JSON.parse(generated), extra: true }), committed)).toBe(false)
    expect(isExactGeneratedVercelConfig('{bad', committed)).toBe(false)
    expect(isExactGeneratedVercelConfig('null', committed)).toBe(false)
  })

  it('retains all other untracked or modified source paths', () => {
    const entries = ['?? vercel.json', '?? src/unknown.ts', ' M apps/hr-suite/vercel.json']
    expect(unexpectedChangesAfterVerifiedVercelConfig(entries, true)).toEqual(entries.slice(1))
    expect(unexpectedChangesAfterVerifiedVercelConfig(entries, false)).toEqual(entries)
  })
})
