import nextEnvironment from '@next/env'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const appRoot = process.cwd()
const hrSuiteRoot = resolve(appRoot, '../hr-suite')

// Gebruik lokaal dezelfde publieke Supabase-projectconfiguratie zonder secrets te kopieren.
nextEnvironment.loadEnvConfig(hrSuiteRoot, true)

const require = createRequire(import.meta.url)
const nextBin = require.resolve('next/dist/bin/next')
const child = spawn(process.execPath, [nextBin, 'dev', '--webpack', '--port', '3001'], {
  cwd: appRoot,
  env: process.env,
  stdio: 'inherit',
})

child.on('exit', (code) => process.exit(code ?? 0))
