import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { jobProfileVersionUpdateSchema } from '@/lib/talent/schemas'
import { TalentServiceError, updateJobProfileVersion } from '@/lib/talent/service'

export async function PATCH(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const parsed = jobProfileVersionUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    const { versionId } = await params
    return NextResponse.json({ data: { id: await updateJobProfileVersion(versionId, parsed.data) } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof TalentServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'JOB_PROFILE_VERSION_UPDATE_FAILED' }, { status: 500 })
  }
}
