#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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
try {
  sourceCommit = runGit(['rev-parse', 'HEAD']).trim()
  gitStatus = runGit(['status', '--porcelain=v1', '--untracked-files=normal', '-z'])
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

const unexpectedChanges = unexpectedBuildSourceChanges(gitStatus, vercelIgnorePatterns)
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
  console.error('Build source gate diagnostics:', JSON.stringify({
    validSourceSha: Boolean(sourceCommit && shaPattern.test(sourceCommit)),
    platformShaProvided: Boolean(platformCommit),
    platformShaMatches: !platformCommit || platformCommit === sourceCommit,
    unexpectedCount: unexpectedChanges.length,
    statusCounts,
    trackedPaths,
  }))
  console.error('Verified build source unavailable: source must be clean and match the platform commit when provided.')
  process.exit(1)
}

mkdirSync(recordDirectory, { recursive: true })
writeFileSync(temporaryPath, `${JSON.stringify({ schemaVersion: 1, sourceCommit }, null, 2)}\n`, { flag: 'w' })
renameSync(temporaryPath, recordPath)
console.log(`Verified clean build source ${sourceCommit}.`)
