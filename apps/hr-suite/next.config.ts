import type { NextConfig } from 'next'
import path from 'node:path'
import { MAX_DOCUMENT_REQUEST_BYTES } from './lib/documents/file-rules'
import { securityHeaders } from './lib/security/security-headers'

const nextConfig: NextConfig = {
  transpilePackages: ['@scope/db'],
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core'],
  outputFileTracingIncludes: {
    '/*': [
      '../../node_modules/playwright-core/browsers.json',
      '../../node_modules/@sparticuz/chromium/bin/**/*',
      '../../node_modules/@sparticuz/chromium/build/**/*',
      '../../node_modules/@fontsource/work-sans/files/*.woff2',
    ],
  },
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
  experimental: {
    proxyClientMaxBodySize: MAX_DOCUMENT_REQUEST_BYTES,
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default nextConfig
