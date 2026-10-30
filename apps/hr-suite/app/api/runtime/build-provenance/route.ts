const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' }
const SHA = /^[a-f0-9]{40}$/i
const PROJECT_ID = /^prj_[A-Za-z0-9]+$/
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]+$/

export const dynamic = 'force-dynamic'

function unavailable(): Response {
  return Response.json({ code: 'BUILD_PROVENANCE_UNAVAILABLE' }, { status: 503, headers: NO_STORE })
}

function supabaseProjectRef(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    const match = url.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)
    if (url.protocol !== 'https:' || url.username || url.password || !match) return null
    return match[1]
  } catch {
    return null
  }
}

export function GET(): Response {
  const sourceSha = process.env.LIQUIDHR_BUILD_SOURCE_SHA
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID
  const projectId = process.env.VERCEL_PROJECT_ID
  const deploymentUrl = process.env.VERCEL_URL
  const targetEnvironment = process.env.VERCEL_TARGET_ENV ?? process.env.VERCEL_ENV
  const supabaseRef = supabaseProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL)

  if (!sourceSha || !SHA.test(sourceSha)
    || !deploymentId || !DEPLOYMENT_ID.test(deploymentId)
    || !projectId || !PROJECT_ID.test(projectId)
    || !deploymentUrl || !/^[a-z0-9.-]+$/i.test(deploymentUrl)
    || !targetEnvironment || !supabaseRef) return unavailable()

  return Response.json({
    schemaVersion: 1,
    sourceSha,
    deploymentId,
    projectId,
    deploymentUrl,
    targetEnvironment,
    supabaseProjectRef: supabaseRef,
    platformSourceSha: process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null,
  }, { headers: NO_STORE })
}
