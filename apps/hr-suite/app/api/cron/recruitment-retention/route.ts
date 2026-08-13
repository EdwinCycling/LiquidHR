import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { runRecruitmentRetention } from '@/lib/recruitment/guided-service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<NextResponse> {
  const configuredSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (!configuredSecret || authorization !== `Bearer ${configuredSecret}`) return NextResponse.json({ code: 'CRON_UNAUTHORIZED' }, { status: 401 })
  try {
    const admin = createAdminClient()
    const result = await runRecruitmentRetention(100, admin)
    const storageKeys = z.array(z.string()).parse(result.storageKeys ?? [])
    if (storageKeys.length > 0) {
      const { error } = await admin.storage.from('recruitment-documents').remove(storageKeys)
      if (error) return NextResponse.json({ code: 'RECRUITMENT_STORAGE_CLEANUP_FAILED' }, { status: 502 })
    }
    return NextResponse.json({ data: { processed: result.processed ?? 0, storageObjectsRemoved: storageKeys.length } })
  } catch {
    return NextResponse.json({ code: 'RECRUITMENT_RETENTION_FAILED' }, { status: 500 })
  }
}
