import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createPlacement, OrganizationServiceError } from '@/lib/organization/management-service'
import { placementCreateSchema } from '@/lib/organization/schemas'
export async function POST(request: Request): Promise<NextResponse> { try { const input = placementCreateSchema.safeParse(await request.json()); if (!input.success) return NextResponse.json({ error: 'PLACEMENT_INPUT_INVALID' }, { status: 400 }); return NextResponse.json({ data: { id: await createPlacement(input.data) } }, { status: 201 }) } catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof OrganizationServiceError) return NextResponse.json({ error: error.code }, { status: error.status }); return NextResponse.json({ error: 'PLACEMENT_CREATE_FAILED' }, { status: 500 }) } }
