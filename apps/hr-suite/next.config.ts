import type { NextConfig } from 'next'
import path from 'node:path'
import { MAX_DOCUMENT_REQUEST_BYTES } from './lib/documents/file-rules'
import { securityHeaders } from './lib/security/security-headers'

const nextConfig: NextConfig = {
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
