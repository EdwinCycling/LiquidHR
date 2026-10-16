import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { jobProfileCreateSchema } from '@/lib/talent/schemas'
import { createJobProfile, listTalentProfileManagement, listTalentProfilesForWorkforce, listTalentWorkforceProfileSummariesForWorkforce, TalentServiceError } from '@/lib/talent/service'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    if (url.searchParams.get('workforce') === 'true') {
      const profileVersionId = url.searchParams.get('profileVersionId')
      if (profileVersionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileVersionId)) {
        return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
      }
      if (profileVersionId) {
        const data = await listTalentProfilesForWorkforce({ profileVersionId })
        return data[0]
          ? NextResponse.json({ data: data[0] })
          : NextResponse.json({ error: 'TALENT_PROFILE_NOT_FOUND' }, { status: 404 })
      }
      return NextResponse.json({ data: await listTalentWorkforceProfileSummariesForWorkforce() })
    }
    return NextResponse.json({ data: await listTalentProfileManagement() })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof TalentServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'TALENT_PROFILE_MANAGEMENT_READ_FAILED' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const parsed = jobProfileCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createJobProfile(parsed.data) } }, { status: 201 })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof TalentServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'JOB_PROFILE_CREATE_FAILED' }, { status: 500 })
  }
}
