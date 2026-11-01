#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(appRoot, '../..')
const recordDirectory = path.join(appRoot, '.vercel')
const recordPath = path.join(recordDirectory, 'liquidhr-build-source.json')
const temporaryPath = `${recordPath}.tmp`
const shaPattern = /^[a-f0-9]{40}$/i

function runGit(args) {
  return execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

let sourceCommit
let gitStatus
const platformCommit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null
try {
  sourceCommit = runGit(['rev-parse', 'HEAD'])
  gitStatus = runGit(['status', '--porcelain', '--untracked-files=normal'])
} catch {
  console.error('Verified build source unavailable: a readable Git checkout is required.')
  process.exit(1)
}

if (!sourceCommit || !shaPattern.test(sourceCommit) || gitStatus !== ''
  || (platformCommit && platformCommit !== sourceCommit)) {
  console.error('Verified build source unavailable: source must be clean and match the platform commit when provided.')
  process.exit(1)
}

mkdirSync(recordDirectory, { recursive: true })
writeFileSync(temporaryPath, `${JSON.stringify({ schemaVersion: 1, sourceCommit }, null, 2)}\n`, { flag: 'w' })
renameSync(temporaryPath, recordPath)
console.log(`Verified clean build source ${sourceCommit}.`)
