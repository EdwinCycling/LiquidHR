#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { determineInstallGate } from './vercel-install-source-policy.mjs'
export { determineInstallGate }

const scriptPath = fileURLToPath(import.meta.url)
const appRoot = path.resolve(path.dirname(scriptPath), '..')
const recordPath = path.join(appRoot, '.vercel', 'liquidhr-build-source.json')

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const platformCommit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null
  const phase = determineInstallGate({
    isVercel: process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV),
    platformCommit,
    attestationExists: existsSync(recordPath),
  })

  if (phase === 'skip') {
    console.log('Skipping Vercel-only source attestation in local install.')
    process.exit(0)
  }
  if (phase === 'fail') {
    console.error('Vercel install source gate: valid platform Git SHA is required.')
    process.exit(1)
  }

  // npm ci runs this postinstall hook before dynamic Vercel config compilation.
  // The second npm ci rechecks the previously recorded SHA and tracked source;
  // config-compiler untracked output is not misclassified as original source.
  const guard = path.join(path.dirname(scriptPath), 'verify-build-source.mjs')
  const args = [guard, ...(phase === 'prebuild' ? ['--prebuild'] : [])]
  const run = spawnSync(process.execPath, args, { stdio: 'inherit' })
  if (run.error) console.error('Vercel install source guard failed to execute.')
  process.exit(run.status === 0 ? 0 : 1)
}
