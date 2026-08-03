import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { jobProfileVersionCopySchema } from '@/lib/talent/schemas'
import { copyJobProfileVersionToDraft } from '@/lib/talent/service'

export async function POST(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  try {
    const parsed = jobProfileVersionCopySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    const { profileId } = await params
    return NextResponse.json({ data: { id: await copyJobProfileVersionToDraft(profileId, parsed.data) } }, { status: 201 })
  } catch (error) {
    return talentErrorResponse(error, 'JOB_PROFILE_VERSION_COPY_FAILED')
  }
}
