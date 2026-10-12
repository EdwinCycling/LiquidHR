import type { NextConfig } from 'next'
import path from 'node:path'
import { MAX_DOCUMENT_REQUEST_BYTES } from './lib/documents/file-rules'
import { securityHeaders } from './lib/security/security-headers'

const serverlessPdfRuntimeFiles = [
  '../../node_modules/playwright-core/browsers.json',
  '../../node_modules/@sparticuz/chromium/bin/*.br',
  '../../node_modules/@sparticuz/chromium/build/*.js',
  '../../node_modules/@fontsource/work-sans/files/work-sans-latin-400-normal.woff2',
  '../../node_modules/@fontsource/work-sans/files/work-sans-latin-700-normal.woff2',
]

const nextConfig: NextConfig = {
  distDir: process.env.LIQUIDHR_NEXT_DIST_DIR === '.next/payrun01-acceptance-20261009'
    ? '.next/payrun01-acceptance-20261009'
    : process.env.LIQUIDHR_NEXT_DIST_DIR === '.next/payrun01-acceptance'
      ? '.next/payrun01-acceptance'
      : process.env.LIQUIDHR_NEXT_DIST_DIR === '.next/payrun01' ? '.next/payrun01' : '.next',
  transpilePackages: ['@scope/db'],
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core'],
  outputFileTracingIncludes: {
    '/api/document-studio/generation/**': [
      ...serverlessPdfRuntimeFiles,
    ],
    '/payroll-lab/salarisverwerking': serverlessPdfRuntimeFiles,
    '/api/payroll-lab/validation-pack': serverlessPdfRuntimeFiles,
    '/api/payroll/runs/*/payslip-preview': [
      ...serverlessPdfRuntimeFiles,
      './public/brand/logo/branding/logo-horizontal.png',
    ],
  },
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
