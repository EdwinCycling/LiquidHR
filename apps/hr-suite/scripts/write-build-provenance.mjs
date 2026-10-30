import { createHash } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const configuredDistDir = process.env.LIQUIDHR_NEXT_DIST_DIR
const supportedDistDirs = [
  '.next/payrun01-acceptance-20261009',
  '.next/payrun01-acceptance',
  '.next/payrun01',
]
const distDir = supportedDistDirs.includes(configuredDistDir) ? configuredDistDir : '.next'
const buildDirectory = path.join(appRoot, distDir)
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

let sourceCommit
try {
  sourceCommit = JSON.parse(readFileSync(path.join(appRoot, '.vercel', 'liquidhr-build-source.json'), 'utf8')).sourceCommit
} catch {
  fail('De geverifieerde Git-buildbron ontbreekt; buildprovenance is niet geschreven.')
}
if (!/^[a-f0-9]{40}$/i.test(sourceCommit)) {
  fail('De build heeft geen verifieerbare Git-commit-SHA; buildprovenance is niet geschreven.')
}
if (process.env.VERCEL_GIT_COMMIT_SHA && process.env.VERCEL_GIT_COMMIT_SHA.trim() !== sourceCommit) {
  fail('De Vercel Git-bron wijkt af van de buildprovenance; buildprovenance is niet geschreven.')
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
