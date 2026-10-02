import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const staticRoot = join(appRoot, '.next', 'static')
const markers = [
  'PAYROLL_LAB_ENABLED',
  'PAYROLL_SUPABASE_URL',
  'PAYROLL_SUPABASE_SECRET_KEY',
  'PAYLAB00_CLIENT_BUNDLE_SENTINEL_20260930',
]

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? listFiles(path) : entry.isFile() ? [path] : []
  })
}

function findMarkers(files) {
  return files.filter((path) => {
    const contents = readFileSync(path)
    return markers.some((marker) => contents.includes(Buffer.from(marker)))
  })
}

function assertAssetsExist(files) {
  if (files.length === 0) throw new Error('No production browser assets were found.')
}

function selfTest() {
  const probePath = join(staticRoot, 'paylab00-client-boundary-self-test.js')
  let probeCreated = false
  try {
    writeFileSync(probePath, 'PAYLAB00_CLIENT_BUNDLE_SENTINEL_20260930', { flag: 'wx' })
    probeCreated = true
    if (!findMarkers(listFiles(staticRoot)).includes(probePath)) {
      throw new Error('The boundary scanner did not detect its temporary probe.')
    }
  } finally {
    if (probeCreated) rmSync(probePath)
  }
}

try {
  // Load server configuration only for an exact-value leak check; never print it.
  nextEnv.loadEnvConfig(appRoot)
  const payrollSecret = process.env.PAYROLL_SUPABASE_SECRET_KEY
  if (payrollSecret) markers.push(payrollSecret)
  const initialFiles = listFiles(staticRoot)
  assertAssetsExist(initialFiles)
  if (process.argv.includes('--self-test')) {
    selfTest()
    console.log('Payroll client-boundary scanner negative control passed.')
  }

  const files = listFiles(staticRoot)
  assertAssetsExist(files)
  const leaks = findMarkers(files)
  if (leaks.length > 0) {
    for (const path of leaks) console.error(`Payroll client-boundary marker found in ${relative(appRoot, path)}`)
    process.exitCode = 1
  } else {
    console.log(`Payroll client-boundary scan passed (${files.length} browser assets).`)
  }
} catch {
  console.error('Payroll client-boundary scan could not read the production browser assets.')
  process.exitCode = 2
}
