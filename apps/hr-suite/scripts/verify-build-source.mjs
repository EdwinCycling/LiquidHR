#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isExactGeneratedVercelConfig, matchesBuildSourceAttestation, unexpectedChangesAfterVerifiedVercelConfig, unexpectedTrackedBuildSourceChanges } from './build-source-attestation.mjs'
import { unexpectedBuildSourceChanges } from './build-source-status.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(appRoot, '../..')
const recordDirectory = path.join(appRoot, '.vercel')
const recordPath = path.join(recordDirectory, 'liquidhr-build-source.json')
const temporaryPath = `${recordPath}.tmp`
const shaPattern = /^[a-f0-9]{40}$/i

function runGit(args) {
  // Porcelain -z has semantic leading spaces in XY status columns. Never trim it.
  return execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}

let sourceCommit
let gitStatus
const platformCommit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null
const phase = process.argv[2]
try {
  sourceCommit = runGit(['rev-parse', 'HEAD']).trim()
  gitStatus = runGit([
    'status',
    '--porcelain=v1',
    phase === '--prebuild' && platformCommit ? '--untracked-files=no' : '--untracked-files=normal',
    '-z',
  ])
} catch {
  console.error('Verified build source unavailable: a readable Git checkout is required.')
  process.exit(1)
}

const vercelIgnorePatterns = []
try {
  vercelIgnorePatterns.push(...readFileSync(path.join(repoRoot, '.vercelignore'), 'utf8').split(/\r?\n/))
} catch {
  // A missing ignore file is valid; it simply means no paths are excluded by Vercel.
}

const rawChanges = unexpectedBuildSourceChanges(gitStatus, vercelIgnorePatterns)
let generatedConfigVerified = false
// Vercel may copy the versioned app config into an untracked project-root
// vercel.json before npm ci postinstall. Verify content, identity and regular
// file type before treating this precise generated copy as harmless.
if (phase !== '--prebuild' && platformCommit && platformCommit === sourceCommit
  && shaPattern.test(sourceCommit) && rawChanges.includes('?? vercel.json')) {
  try {
    const generatedPath = path.join(repoRoot, 'vercel.json')
    if (lstatSync(generatedPath).isFile()) {
      generatedConfigVerified = isExactGeneratedVercelConfig(
        readFileSync(generatedPath, 'utf8'),
        readFileSync(path.join(appRoot, 'vercel.json'), 'utf8'),
      )
    }
  } catch {
    generatedConfigVerified = false
  }
}
const unexpectedChanges = unexpectedChangesAfterVerifiedVercelConfig(rawChanges, generatedConfigVerified)
if (phase === '--prebuild' && platformCommit) {
  let attestedCommit
  try {
    const parsed = JSON.parse(readFileSync(recordPath, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error()
    attestedCommit = parsed.sourceCommit
  } catch {
    console.error('Verified build source unavailable: the post-install source attestation is missing.')
    process.exit(1)
  }

  const trackedChanges = unexpectedTrackedBuildSourceChanges(gitStatus, vercelIgnorePatterns)
  if (!matchesBuildSourceAttestation({ sourceCommit, platformCommit, attestedCommit }) || trackedChanges.length > 0) {
    const statusCounts = Object.create(null)
    for (const entry of trackedChanges) {
      const status = entry.slice(0, 2)
      statusCounts[status] = (statusCounts[status] ?? 0) + 1
    }
    console.error('Build source gate diagnostics:', JSON.stringify({
      validSourceSha: Boolean(sourceCommit && shaPattern.test(sourceCommit)),
      platformShaProvided: true,
      platformShaMatches: platformCommit === sourceCommit,
      installAttestationMatches: attestedCommit === sourceCommit,
      unexpectedCount: trackedChanges.length,
      statusCounts,
      trackedPaths: trackedChanges.slice(0, 8).map((entry) => entry.slice(3)),
    }))
    console.error('Verified build source unavailable: source must match the post-install attestation and platform commit.')
    process.exit(1)
  }

  console.log(`Verified post-install build source ${sourceCommit}.`)
  process.exit(0)
}

if (!sourceCommit || !shaPattern.test(sourceCommit) || unexpectedChanges.length > 0
  || (platformCommit && platformCommit !== sourceCommit)) {
  // Never log file contents, secrets, environment values, or untracked filenames.
  const statusCounts = Object.create(null)
  for (const entry of unexpectedChanges) {
    const status = entry.slice(0, 2)
    statusCounts[status] = (statusCounts[status] ?? 0) + 1
  }
  const trackedPaths = unexpectedChanges
    .filter((entry) => entry.slice(0, 2) !== '??')
    .slice(0, 8)
    .map((entry) => entry.slice(3))
  // Filenames only, never file contents or local filesystem paths.
  // Redact potential credential names, control characters and unsupported paths.
  const untrackedPaths = unexpectedChanges
    .filter((entry) => entry.slice(0, 2) === '??')
    .slice(0, 5)
    .map((entry) => {
      const candidate = entry.slice(3).replaceAll('\\', '/')
      return /^[a-zA-Z0-9._/\\-]{1,160}$/.test(candidate)
        && !/(^|[._/\\-])(env|secret|secrets|token|credential|credentials|password|passwd|cookie|session|private|pem|key|ssh|auth)(?=$|[._/\\-])/i.test(candidate)
        ? candidate : '[redacted]'
    })
  console.error('Build source gate diagnostics:', JSON.stringify({
    validSourceSha: Boolean(sourceCommit && shaPattern.test(sourceCommit)),
    platformShaProvided: Boolean(platformCommit),
    platformShaMatches: !platformCommit || platformCommit === sourceCommit,
    unexpectedCount: unexpectedChanges.length,
    statusCounts,
    trackedPaths,
    untrackedPaths,
  }))
  console.error('Verified build source unavailable: source must be clean and match the platform commit when provided.')
  process.exit(1)
}

mkdirSync(recordDirectory, { recursive: true })
writeFileSync(temporaryPath, `${JSON.stringify({ schemaVersion: 1, sourceCommit }, null, 2)}\n`, { flag: 'w' })
renameSync(temporaryPath, recordPath)
console.log(`Verified clean build source ${sourceCommit}.`)
