import type { NextConfig } from 'next'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { MAX_DOCUMENT_REQUEST_BYTES } from './lib/documents/file-rules'
import { securityHeaders } from './lib/security/security-headers'
import { matchesBuildSourceAttestation, unexpectedTrackedBuildSourceChanges } from './scripts/build-source-attestation.mjs'
import { unexpectedBuildSourceChanges } from './scripts/build-source-status.mjs'

function verifiedBuildSourceSha(): string | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined
  const repoRoot = path.resolve(__dirname, '../..')
  const recordPath = path.join(__dirname, '.vercel', 'liquidhr-build-source.json')
  const platformCommit = process.env.VERCEL_GIT_COMMIT_SHA?.trim()
  let gitCommit: string | null = null
  let gitStatus: string | null = null
  try {
    gitCommit = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    gitStatus = execFileSync('git', ['-C', repoRoot, 'status', '--porcelain=v1', '--untracked-files=normal', '-z'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    throw new Error('A readable, clean Git source is required for production builds.')
  }

  const sourceCommit = gitCommit
  if (!sourceCommit || !/^[a-f0-9]{40}$/i.test(sourceCommit)) {
    throw new Error('A valid Git source SHA is required for production builds.')
  }
  if (platformCommit && platformCommit !== sourceCommit) {
    throw new Error('Vercel and Git source SHAs must match for production builds.')
  }

  // The strict npm postinstall gate already checked Git SHA and all source
  // changes, including untracked paths. Verify its recorded SHA BEFORE
  // permitting hosted-generated untracked build/config output.
  let recordedCommit: unknown
  try {
    const parsed: unknown = JSON.parse(readFileSync(recordPath, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error()
    recordedCommit = (parsed as { sourceCommit?: unknown }).sourceCommit
  } catch {
    throw new Error('A verified Git source SHA is required for production builds.')
  }
  if (!matchesBuildSourceAttestation({ sourceCommit, platformCommit: platformCommit ?? null, attestedCommit: recordedCommit })) {
    throw new Error('Build-source preflight, Git, and Vercel source SHAs must match.')
  }

  const allowedGeneratedPath = 'apps/hr-suite/lib/workforce-tools/mcp/focus-widget-resource.ts'
  // NUL-separated porcelain preserves unquoted names with spaces and XY prefixes.
  const statusEntries = gitStatus
  let vercelIgnorePatterns: string[] = []
  try {
    vercelIgnorePatterns = readFileSync(path.join(repoRoot, '.vercelignore'), 'utf8').split(/\r?\n/)
  } catch {
    // Missing ignore rules cannot authorize omissions: default fail-closed.
  }
  // A child Next process need not expose the same VERCEL_GIT_COMMIT_SHA as the
  // npm install runner. In Vercel, the previous strict source attestation is
  // independently verified above and requires the exact Git source SHA.
  const hostedVercelBuild = Boolean(platformCommit || process.env.VERCEL === '1' || process.env.VERCEL_ENV)
  const unexpectedChanges = hostedVercelBuild
    ? unexpectedTrackedBuildSourceChanges(statusEntries, vercelIgnorePatterns)
    : unexpectedBuildSourceChanges(statusEntries, vercelIgnorePatterns)
  const changedPaths = unexpectedChanges.map((line) => line.slice(3).replaceAll('\\', '/'))
  if (changedPaths.some((changedPath) => changedPath !== allowedGeneratedPath)) {
    // No file contents, secrets or environment values are logged.
    const safePaths = changedPaths.slice(0, 10).map((filePath) =>
      /(^|[._/\-])(env|secret|token|credential|password|cookie|session|private|pem|key|ssh|auth)(?=$|[._/\-])/i.test(filePath)
        ? '[redacted]' : filePath)
    console.error('Next source gate diagnostics:', JSON.stringify({
      hostedVercelBuild,
      platformShaProvided: Boolean(platformCommit),
      sourceAttestationVerified: true,
      unexpectedTrackedCount: changedPaths.length,
      changedPaths: safePaths,
    }))
    throw new Error('The production build source changed outside the verified build and its Focus widget output.')
  }
  return sourceCommit
}

const buildSourceSha = verifiedBuildSourceSha()

const nextConfig: NextConfig = {
  ...(buildSourceSha ? { env: { LIQUIDHR_BUILD_SOURCE_SHA: buildSourceSha } } : {}),
  distDir: process.env.LIQUIDHR_NEXT_DIST_DIR === '.next/payrun01-acceptance-20261009'
    ? '.next/payrun01-acceptance-20261009'
    : process.env.LIQUIDHR_NEXT_DIST_DIR === '.next/payrun01-acceptance'
      ? '.next/payrun01-acceptance'
      : process.env.LIQUIDHR_NEXT_DIST_DIR === '.next/payrun01' ? '.next/payrun01' : '.next',
  transpilePackages: [
    '@scope/db',
    '@liquid-hr/payroll-engine',
    '@liquid-hr/payroll-rules-nl-2026',
    '@liquid-hr/payroll-rules-cao-bench02',
  ],
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core'],
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
  experimental: {
    proxyClientMaxBodySize: MAX_DOCUMENT_REQUEST_BYTES,
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders.filter(({ key }) => key !== 'X-Frame-Options') },
    ]
  },
}

export default nextConfig
