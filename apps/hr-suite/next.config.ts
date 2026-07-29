import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  transpilePackages: ['@scope/db'],
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
}

export default nextConfig
