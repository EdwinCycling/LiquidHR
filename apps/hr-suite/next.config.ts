import type { NextConfig } from 'next'
import path from 'node:path'
import { securityHeaders } from './lib/security/security-headers'

const nextConfig: NextConfig = {
  transpilePackages: ['@scope/db'],
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default nextConfig
