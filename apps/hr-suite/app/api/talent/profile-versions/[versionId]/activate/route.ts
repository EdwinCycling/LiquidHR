import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { jobProfileVersionActivateSchema } from '@/lib/talent/schemas'
import { activateJobProfileVersion } from '@/lib/talent/service'

export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const parsed = jobProfileVersionActivateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    const { versionId } = await params
    return NextResponse.json({ data: { id: await activateJobProfileVersion(versionId, parsed.data) } })
  } catch (error) {
    return talentErrorResponse(error, 'JOB_PROFILE_ACTIVATION_FAILED')
  }
}
