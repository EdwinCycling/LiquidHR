import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { ActualWorkServiceError, voidActualWorkEntry } from '@/lib/actual-work/actual-work-service'

function errorCode(error: unknown): string {
  if (error instanceof ActualWorkServiceError) return error.code
  if (error instanceof Error && /^ACTUAL_WORK_[A-Z_]+$/.test(error.message)) return error.message
  return 'ACTUAL_WORK_ENTRY_VOID_FAILED'
}

export async function POST(request: Request) {
  try {
    const entry = await voidActualWorkEntry(await request.json())
    return NextResponse.json({ data: { id: entry.id, status: entry.status } })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return NextResponse.json({ error: 'ACTUAL_WORK_NOT_AUTHORIZED' }, { status: response.status })
    return NextResponse.json({ error: errorCode(error) }, { status: error instanceof ActualWorkServiceError ? error.status : 400 })
  }
}
