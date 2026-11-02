import { describe, expect, it } from 'vitest'
import { matchesBuildSourceAttestation, unexpectedTrackedBuildSourceChanges } from './build-source-attestation.mjs'
import { unexpectedBuildSourceChanges } from './build-source-status.mjs'

const commit = 'a'.repeat(40)

describe('build source attestation timing', () => {
  it('requires valid and matching source, platform, and install attestations', () => {
    expect(matchesBuildSourceAttestation({ sourceCommit: commit, platformCommit: commit, attestedCommit: commit })).toBe(true)
    expect(matchesBuildSourceAttestation({ sourceCommit: commit, platformCommit: 'b'.repeat(40), attestedCommit: commit })).toBe(false)
    expect(matchesBuildSourceAttestation({ sourceCommit: commit, platformCommit: commit, attestedCommit: 'b'.repeat(40) })).toBe(false)
    expect(matchesBuildSourceAttestation({ sourceCommit: 'invalid', platformCommit: null, attestedCommit: 'invalid' })).toBe(false)
    // A verified recorded SHA is valid even when a Next child process lacks platform env.
    expect(matchesBuildSourceAttestation({ sourceCommit: commit, platformCommit: null, attestedCommit: commit })).toBe(true)
  })

  it('rejects all untracked files in the strict post-install gate', () => {
    expect(unexpectedBuildSourceChanges('?? generated-config.json\0')).toEqual(['?? generated-config.json'])
  })

  it('applies repository Vercel ignore rules to tracked deletions after attestation', () => {
    const status = [
      ' D .artifacts/deleted-report.png',
      ' D .qoder/deleted-cache.md',
      ' D .mcp.json',
      '?? vercel.json',
      ' M apps/hr-suite/app/page.tsx',
    ].join('\0')
    expect(unexpectedTrackedBuildSourceChanges(status, ['.artifacts/', '.qoder/', '.mcp.json']))
      .toEqual([' M apps/hr-suite/app/page.tsx'])
  })

  it('correctly matches Vercel-ignored paths containing spaces in NUL-separated git status', () => {
    const patterns = ['.qoder/', '.artifacts/']
    const rawPorcelainZ = [
      ' D .qoder/repowiki/en/content/API Reference/AI Assistant APIs.md',
      ' D .artifacts/Focus Screenshot 1.png',
      ' M apps/hr-suite/app/page.tsx',
    ].join('\0')
    expect(unexpectedTrackedBuildSourceChanges(rawPorcelainZ, patterns))
      .toEqual([' M apps/hr-suite/app/page.tsx'])
  })

  it('continues to reject tracked changes after Vercel config compilation', () => {
    const status = [
      '?? generated-config.json',
      ' M package-lock.json',
      ' M apps/hr-suite/vercel.ts',
    ].join('\0')

    expect(unexpectedTrackedBuildSourceChanges(status)).toEqual([
      ' M package-lock.json',
      ' M apps/hr-suite/vercel.ts',
    ])
  })
})
