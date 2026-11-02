import { describe, expect, it } from 'vitest'
import { determineInstallGate } from './vercel-install-source.mjs'

const commit = 'a'.repeat(40)

describe('Vercel npm install lifecycle source attestation', () => {
  it('skips ordinary local npm ci installs', () => {
    expect(determineInstallGate({ isVercel: false, platformCommit: null, attestationExists: false })).toBe('skip')
  })

  it('fails closed when the Vercel SHA is absent or invalid', () => {
    expect(determineInstallGate({ isVercel: true, platformCommit: null, attestationExists: false })).toBe('fail')
    expect(determineInstallGate({ isVercel: true, platformCommit: 'bad', attestationExists: true })).toBe('fail')
  })

  it('attests strictly before config compilation', () => {
    expect(determineInstallGate({ isVercel: true, platformCommit: commit, attestationExists: false })).toBe('strict')
  })

  it('checks recorded attestation and tracked source on repeated npm ci', () => {
    expect(determineInstallGate({ isVercel: true, platformCommit: commit, attestationExists: true })).toBe('prebuild')
  })
})
