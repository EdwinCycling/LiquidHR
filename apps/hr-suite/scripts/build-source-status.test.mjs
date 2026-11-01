import { describe, expect, it } from 'vitest'
import { unexpectedBuildSourceChanges } from './build-source-status.mjs'

const vercelIgnorePatterns = ['.artifacts/', '**/.artifacts/', '.qoder/', '.mcp.json']

describe('Vercel build source status', () => {
  it('allows only worktree deletions that Vercel intentionally excludes', () => {
    const status = [
      ' D .artifacts/focus-acceptance/report.png',
      ' D .qoder/cache/index.md',
      ' D .mcp.json',
    ].join('\0')

    expect(unexpectedBuildSourceChanges(status, vercelIgnorePatterns)).toEqual([])
  })

  it('keeps modified, staged, untracked, and non-excluded paths as build blockers', () => {
    const status = [
      ' M apps/hr-suite/app/page.tsx',
      'D  .artifacts/removed-before-upload.png',
      '?? .artifacts/untracked.png',
      ' D apps/hr-suite/package.json',
    ].join('\0')

    expect(unexpectedBuildSourceChanges(status, vercelIgnorePatterns)).toEqual(status.split('\0'))
  })

  it('supports nested exclusions and applies negated rules in order', () => {
    const status = [
      ' D apps/hr-suite/test-results/output.json',
      ' D apps/hr-suite/.artifacts/kept/report.png',
    ].join('\0')
    const patterns = ['**/test-results/', '**/.artifacts/', '!apps/hr-suite/.artifacts/kept/']

    expect(unexpectedBuildSourceChanges(status, patterns)).toEqual([' D apps/hr-suite/.artifacts/kept/report.png'])
  })
})
