import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { jobProfileCreateSchema } from '@/lib/talent/schemas'
import { createJobProfile, listTalentProfileManagement, TalentServiceError } from '@/lib/talent/service'

export async function GET() {
  try {
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
