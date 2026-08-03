import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { jobFamilyCreateSchema } from '@/lib/talent/schemas'
import { createJobFamily, TalentServiceError } from '@/lib/talent/service'

export async function POST(request: Request) {
  try {
    const parsed = jobFamilyCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createJobFamily(parsed.data) } }, { status: 201 })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof TalentServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'JOB_FAMILY_CREATE_FAILED' }, { status: 500 })
  }
}
