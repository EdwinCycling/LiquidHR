import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createActualWorkType, listActualWorkTypes } from '@/lib/actual-work/actual-work-service'

export async function GET(request: Request) {
  try {
    const includeInactive = new URL(request.url).searchParams.get('includeInactive') === 'true'
    return NextResponse.json({ data: await listActualWorkTypes(includeInactive) })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ACTUAL_WORK_TYPES_FAILED' }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json({ data: await createActualWorkType(await request.json()) }, { status: 201 })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ACTUAL_WORK_TYPE_CREATE_FAILED' }, { status: 400 })
  }
}
