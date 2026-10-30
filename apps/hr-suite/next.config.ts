import type { NextConfig } from 'next'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { MAX_DOCUMENT_REQUEST_BYTES } from './lib/documents/file-rules'
import { securityHeaders } from './lib/security/security-headers'

function verifiedBuildSourceSha(): string | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined
  const repoRoot = path.resolve(__dirname, '../..')
  const recordPath = path.join(__dirname, '.vercel', 'liquidhr-build-source.json')
  const platformCommit = process.env.VERCEL_GIT_COMMIT_SHA?.trim()
  let gitCommit: string | null = null
  let gitStatus: string | null = null
  try {
    gitCommit = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    gitStatus = execFileSync('git', ['-C', repoRoot, 'status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    throw new Error('A readable, clean Git source is required for production builds.')
  }

  const sourceCommit = gitCommit
  const changedPaths = gitStatus.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3).replaceAll('\\', '/'))
  const allowedGeneratedPath = 'apps/hr-suite/lib/workforce-tools/mcp/focus-widget-resource.ts'
  if (!sourceCommit || !/^[a-f0-9]{40}$/i.test(sourceCommit) || changedPaths.some((changedPath) => changedPath !== allowedGeneratedPath)) {
    throw new Error('The production build source changed outside the verified build and its Focus widget output.')
  }
  if (platformCommit && platformCommit !== sourceCommit) {
    throw new Error('Vercel and Git source SHAs must match for production builds.')
  }

  let recordedCommit: unknown
  try {
    const parsed: unknown = JSON.parse(readFileSync(recordPath, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error()
    recordedCommit = (parsed as { sourceCommit?: unknown }).sourceCommit
  } catch {
    throw new Error('A verified Git source SHA is required for production builds.')
  }
  if (recordedCommit !== sourceCommit) throw new Error('Build-source preflight and Git source SHAs must match.')
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
