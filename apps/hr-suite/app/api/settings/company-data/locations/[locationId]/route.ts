import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { CompanyDataServiceError, deleteLocation, updateLocation } from '@/lib/company-data/service'
import { locationUpdateSchema } from '@/lib/company-data/schemas'

export async function PATCH(request: Request, { params }: { params: Promise<{ locationId: string }> }): Promise<NextResponse> {
  try {
    const parsed = locationUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'LOCATION_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await updateLocation((await params).locationId, parsed.data) })
  } catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof CompanyDataServiceError) return NextResponse.json({ error: error.code }, { status: error.status }); return NextResponse.json({ error: 'LOCATION_UPDATE_FAILED' }, { status: 500 }) }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ locationId: string }> }): Promise<NextResponse> {
  try { await deleteLocation((await params).locationId); return NextResponse.json({ data: { deleted: true } }) }
  catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof CompanyDataServiceError) return NextResponse.json({ error: error.code }, { status: error.status }); return NextResponse.json({ error: 'LOCATION_DELETE_FAILED' }, { status: 500 }) }
}
