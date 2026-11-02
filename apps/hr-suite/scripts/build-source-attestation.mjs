import { unexpectedBuildSourceChanges } from './build-source-status.mjs'

const shaPattern = /^[a-f0-9]{40}$/i

export function matchesBuildSourceAttestation({ sourceCommit, platformCommit, attestedCommit }) {
  return typeof sourceCommit === 'string'
    && shaPattern.test(sourceCommit)
    && attestedCommit === sourceCommit
    && (!platformCommit || platformCommit === sourceCommit)
}

/**
 * After the strict post-install gate, Vercel may create untracked configuration
 * output while compiling vercel.ts. Keep checking every tracked path here; the
 * earlier gate rejects untracked source before that step.
 */
export function unexpectedTrackedBuildSourceChanges(statusOutput, vercelIgnorePatterns = []) {
  return unexpectedBuildSourceChanges(statusOutput, vercelIgnorePatterns)
    .filter((entry) => entry.slice(0, 2) !== '??')
}
