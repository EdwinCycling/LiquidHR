import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { isPdfRuntimeFile, normalizeTraceRoute, pdfRendererKind } from './function-trace-policy.mjs'

const MiB = 1024 * 1024
const warningLimit = 150 * MiB
const failureLimit = 225 * MiB
const appRoot = process.cwd()
const distDir = path.resolve(appRoot, process.env.LIQUIDHR_NEXT_DIST_DIR || '.next')
const routeRoot = path.join(distDir, 'server', 'app')
function normalizeFile(file) {
  return file.replaceAll('\\', '/').toLowerCase()
}

function routeFromManifest(manifestPath) {
  const relative = path.relative(routeRoot, manifestPath).replaceAll('\\', '/')
  const route = relative
    .replace(/\/(?:page|route)\.js\.nft\.json$/, '')
    .replace(/^(?:page|route)\.js\.nft\.json$/, '')
  return route ? '/' + route : '/'
}

async function findManifests(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await findManifests(fullPath))
    } else if (entry.isFile() && /(?:page|route)\.js\.nft\.json$/.test(entry.name)) {
      files.push(fullPath)
    }
  }
  return files
}

async function packageTrace(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  let size = 0
  let fileCount = 0
  const files = []
  for (const relativeFile of manifest.files) {
    const absoluteFile = path.resolve(path.dirname(manifestPath), relativeFile)
    try {
      const fileStats = await stat(absoluteFile)
      if (!fileStats.isFile()) continue
      size += fileStats.size
      fileCount += 1
      files.push(normalizeFile(relativeFile))
    } catch {
      throw new Error('NFT-listed file is missing: ' + relativeFile + ' (' + manifestPath + ')')
    }
  }
  return {
    route: routeFromManifest(manifestPath),
    size,
    fileCount,
    files,
  }
}

function hasSuffix(files, suffix) {
  const normalizedSuffix = suffix.toLowerCase()
  return files.some((file) => file.endsWith(normalizedSuffix))
}

async function namesIn(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true })
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(extension)).map((entry) => entry.name)
}

function renderTable(records) {
  console.log('Rank  Route  MiB  Files')
  records.slice(0, 10).forEach((record, index) => {
    console.log(
      String(index + 1).padStart(4) + '  '
      + record.route + '  '
      + (record.size / MiB).toFixed(2) + '  '
      + record.fileCount,
    )
  })
  const topTenTotal = records.slice(0, 10).reduce((total, record) => total + record.size, 0)
  const allTotal = records.reduce((total, record) => total + record.size, 0)
  console.log('Top 10 combined: ' + (topTenTotal / MiB).toFixed(2) + ' MiB')
  console.log('All App Router function traces: ' + records.length + ', ' + (allTotal / MiB).toFixed(2) + ' MiB')
  console.log('Sizes sum traced files before compression; they are not Vercel ZIP sizes.')
}

async function main() {
  const manifestPaths = await findManifests(routeRoot)
  const records = await Promise.all(manifestPaths.map(packageTrace))
  records.sort((left, right) => right.size - left.size || left.route.localeCompare(right.route))
  renderTable(records)

  const errors = []
  for (const record of records) {
    if (record.size > failureLimit) {
      errors.push(record.route + ' exceeds the 225 MiB traced-package budget.')
    } else if (record.size > warningLimit) {
      console.warn('WARNING: ' + record.route + ' exceeds the 150 MiB warning threshold.')
    }

    const hasRuntimePackage = record.files.some(isPdfRuntimeFile)
    const route = normalizeTraceRoute(record.route)
    const rendererKind = pdfRendererKind(route)
    const isPdfRoute = rendererKind !== null
    if (hasRuntimePackage && !isPdfRoute) {
      errors.push(route + ' contains Chromium/Playwright runtime files but is not an approved PDF renderer.')
    }
    if (!isPdfRoute) continue

    const requiredFiles = [
      '/node_modules/playwright-core/browsers.json',
      '/node_modules/@fontsource/work-sans/files/work-sans-latin-400-normal.woff2',
      '/node_modules/@fontsource/work-sans/files/work-sans-latin-700-normal.woff2',
    ]
    if (rendererKind === 'document-studio') {
      requiredFiles.push('/node_modules/@fontsource/work-sans/files/work-sans-latin-400-italic.woff2')
    }
    if (rendererKind === 'payslip') {
      requiredFiles.push('/public/brand/logo/branding/logo-horizontal.png')
    }
    const chromiumDirectory = path.resolve(appRoot, '../../node_modules/@sparticuz/chromium/bin')
    const chromiumAssets = await namesIn(chromiumDirectory, '.br')
    requiredFiles.push(...chromiumAssets.map((name) => '/node_modules/@sparticuz/chromium/bin/' + name))
    const chromiumBuildDirectory = path.resolve(appRoot, '../../node_modules/@sparticuz/chromium/build')
    const chromiumBuildFiles = await namesIn(chromiumBuildDirectory, '.js')
    requiredFiles.push(...chromiumBuildFiles.map((name) => '/node_modules/@sparticuz/chromium/build/' + name))

    const missingFiles = requiredFiles.filter((file) => !hasSuffix(record.files, file))
    if (missingFiles.length > 0) {
      errors.push(route + ' is missing required PDF runtime asset(s): ' + missingFiles.join(', '))
    }
    if (!record.files.some((file) => file.includes('/node_modules/@sparticuz/chromium/bin/') && file.endsWith('.br'))) {
      errors.push(route + ' is missing compressed Chromium runtime binaries.')
    }
  }

  if (records.length === 0) errors.push('No App Router page/route NFT manifests were found.')
  if (errors.length > 0) {
    for (const error of errors) console.error('ERROR: ' + error)
    process.exitCode = 1
    return
  }
  console.log('PDF runtime route allowlist and required Chromium, Playwright, font, and logo assets: PASS')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Function trace check failed.')
  process.exitCode = 1
})
