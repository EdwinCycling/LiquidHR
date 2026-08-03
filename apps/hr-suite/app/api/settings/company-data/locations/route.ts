import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { CompanyDataServiceError, createLocation } from '@/lib/company-data/service'
import { locationCreateSchema } from '@/lib/company-data/schemas'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = locationCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'LOCATION_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await createLocation(parsed.data) }, { status: 201 })
  } catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof CompanyDataServiceError) return NextResponse.json({ error: error.code }, { status: error.status }); return NextResponse.json({ error: 'LOCATION_CREATE_FAILED' }, { status: 500 }) }
}
