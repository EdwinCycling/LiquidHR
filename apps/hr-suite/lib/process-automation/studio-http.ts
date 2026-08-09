import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { studioErrorResponse } from './studio-service'

export function studioHttpError(error: unknown, fallbackCode = 'PROCESS_DEFINITION_STUDIO_FAILED'): NextResponse {
  const permissionResponse = permissionErrorResponse(error)
  if (permissionResponse) return permissionResponse
  const serviceResponse = studioErrorResponse(error)
  if (serviceResponse) return NextResponse.json(serviceResponse.body, { status: serviceResponse.status })
  return NextResponse.json({ code: fallbackCode }, { status: 500 })
}
