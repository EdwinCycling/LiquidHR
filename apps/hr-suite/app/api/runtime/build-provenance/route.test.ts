import { afterEach, describe, expect, it } from 'vitest'
import { GET } from './route'

const keys = [
  'LIQUIDHR_BUILD_SOURCE_SHA',
  'VERCEL_DEPLOYMENT_ID',
  'VERCEL_PROJECT_ID',
  'VERCEL_URL',
  'VERCEL_TARGET_ENV',
  'VERCEL_ENV',
  'VERCEL_GIT_COMMIT_SHA',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const
const original = new Map(keys.map((key) => [key, process.env[key]]))

afterEach(() => {
  for (const key of keys) {
    const value = original.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('build provenance endpoint', () => {
  it('fails closed when independent runtime fields are missing', async () => {
    delete process.env.LIQUIDHR_BUILD_SOURCE_SHA
    const response = GET()
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toContain('no-store')
    await expect(response.json()).resolves.toEqual({ code: 'BUILD_PROVENANCE_UNAVAILABLE' })
  })

  it('returns only non-secret build, deployment, and Core TEST identifiers', async () => {
    process.env.LIQUIDHR_BUILD_SOURCE_SHA = 'a'.repeat(40)
    process.env.VERCEL_DEPLOYMENT_ID = 'dpl_RuntimeProof123'
    process.env.VERCEL_PROJECT_ID = 'prj_RuntimeProof123'
    process.env.VERCEL_URL = 'liquidhr-runtime-proof.vercel.app'
    process.env.VERCEL_TARGET_ENV = 'production'
    process.env.VERCEL_GIT_COMMIT_SHA = ''
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://wnpfloqpjvaacobppbpk.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'must-not-be-returned'

    const response = GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    const body: unknown = await response.json()
    expect(body).toEqual({
      schemaVersion: 1,
      sourceSha: 'a'.repeat(40),
      deploymentId: 'dpl_RuntimeProof123',
      projectId: 'prj_RuntimeProof123',
      deploymentUrl: 'liquidhr-runtime-proof.vercel.app',
      targetEnvironment: 'production',
      supabaseProjectRef: 'wnpfloqpjvaacobppbpk',
      platformSourceSha: null,
    })
    expect(JSON.stringify(body)).not.toContain('must-not-be-returned')
  })
})
