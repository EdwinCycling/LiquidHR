import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isPdfRuntimeFile, normalizeTraceRoute, pdfRendererKind } from './function-trace-policy.mjs'

const appRoot = process.cwd()
const distDir = path.resolve(appRoot, process.env.LIQUIDHR_NEXT_DIST_DIR || '.next')
const routeRoot = path.join(distDir, 'server', 'app')
const nodeModules = path.resolve(appRoot, '../../node_modules')
const MiB = 1024 * 1024

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
    if (entry.isDirectory()) files.push(...await findManifests(fullPath))
    else if (entry.isFile() && /(?:page|route)\.js\.nft\.json$/.test(entry.name)) files.push(fullPath)
  }
  return files
}

async function requiredAssets(kind) {
  const assets = [
    path.join(nodeModules, 'playwright-core', 'browsers.json'),
    path.join(nodeModules, '@fontsource', 'work-sans', 'files', 'work-sans-latin-400-normal.woff2'),
    path.join(nodeModules, '@fontsource', 'work-sans', 'files', 'work-sans-latin-700-normal.woff2'),
  ]
  if (kind === 'document-studio') {
    assets.push(path.join(nodeModules, '@fontsource', 'work-sans', 'files', 'work-sans-latin-400-italic.woff2'))
  }
  if (kind === 'payslip') {
    assets.push(path.join(appRoot, 'public', 'brand', 'logo', 'branding', 'logo-horizontal.png'))
  }

  const chromiumBin = path.join(nodeModules, '@sparticuz', 'chromium', 'bin')
  const chromiumBuild = path.join(nodeModules, '@sparticuz', 'chromium', 'build')
  for (const name of await readdir(chromiumBin)) {
    if (name.endsWith('.br')) assets.push(path.join(chromiumBin, name))
  }
  for (const name of await readdir(chromiumBuild)) {
    if (name.endsWith('.js')) assets.push(path.join(chromiumBuild, name))
  }
  return assets
}

async function main() {
  const manifestPaths = await findManifests(routeRoot)
  const expectedRoutes = [
    '/api/document-studio/generation/[snapshotId]/finalize',
    '/api/document-studio/distributions',
    '/api/payroll-lab/validation-pack',
    '/payroll-lab/salarisverwerking',
    '/api/payroll/runs/[runId]/payslip-preview',
  ]
  const foundRoutes = new Set()
  let strippedRoutes = 0
  let attachedRoutes = 0
  let attachedBytes = 0

  for (const manifestPath of manifestPaths) {
    const route = routeFromManifest(manifestPath)
    const normalizedRoute = normalizeTraceRoute(route)
    const kind = pdfRendererKind(route)
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    const files = new Set(manifest.files)
    if (kind) {
      foundRoutes.add(normalizedRoute)
      const assets = await requiredAssets(kind)
      for (const asset of assets) {
        const details = await stat(asset).catch(() => null)
        if (!details?.isFile()) throw new Error('Required PDF runtime asset is missing: ' + path.relative(appRoot, asset))
        files.add(path.relative(path.dirname(manifestPath), asset).replaceAll('\\', '/'))
        attachedBytes += details.size
      }
      attachedRoutes += 1
    } else {
      const originalSize = files.size
      for (const file of files) {
        if (isPdfRuntimeFile(file)) files.delete(file)
      }
      if (files.size !== originalSize) strippedRoutes += 1
    }
    manifest.files = [...files]
    await writeFile(manifestPath, JSON.stringify(manifest) + '\n')
  }

  const missingRoutes = expectedRoutes.filter((route) => !foundRoutes.has(route))
  if (missingRoutes.length > 0) throw new Error('PDF renderer trace manifest(s) missing: ' + missingRoutes.join(', '))
  console.log(`Prepared exact PDF function traces: ${attachedRoutes} renderer routes, Chromium/Playwright removed from ${strippedRoutes} non-renderer routes.`)
  console.log('Required renderer trace inputs: ' + (attachedBytes / MiB).toFixed(2) + ' MiB (uncompressed).')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Function trace preparation failed.')
  process.exitCode = 1
})
