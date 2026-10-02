import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const buildDirectory = path.join(appRoot, '.next')
const buildIdPath = path.join(buildDirectory, 'BUILD_ID')

function fail(message) {
  console.error(message)
  process.exit(1)
}

let buildId
try {
  buildId = readFileSync(buildIdPath, 'utf8').trim()
} catch {
  fail('Next.js BUILD_ID ontbreekt; buildprovenance is niet geschreven.')
}

const sourceCommit = (process.env.VERCEL_GIT_COMMIT_SHA ?? execFileSync(
  'git',
  ['-C', path.resolve(appRoot, '../..'), 'rev-parse', 'HEAD'],
  { encoding: 'utf8' },
)).trim()
if (!/^[a-f0-9]{40}$/i.test(sourceCommit)) {
  fail('De build heeft geen verifieerbare Git-commit-SHA; buildprovenance is niet geschreven.')
}

const publicRuntimeFingerprint = createHash('sha256')
for (const [name, value] of Object.entries(process.env)
  .filter(([name]) => name.startsWith('NEXT_PUBLIC_'))
  .sort(([left], [right]) => left.localeCompare(right))) {
  publicRuntimeFingerprint.update(name).update('\0').update(value).update('\n')
}

const temporaryPath = path.join(buildDirectory, '.liquidhr-build-provenance.tmp')
const provenancePath = path.join(buildDirectory, 'liquidhr-build-provenance.json')
const payload = {
  schemaVersion: 1,
  sourceCommit,
  buildId,
  publicRuntimeFingerprint: publicRuntimeFingerprint.digest('hex'),
}

writeFileSync(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, { flag: 'w' })
renameSync(temporaryPath, provenancePath)
console.log(`Build provenance written for ${sourceCommit}; runtime values are not included.`)
