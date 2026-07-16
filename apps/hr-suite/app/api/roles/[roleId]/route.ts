import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { OrganizationServiceError, updateRole } from '@/lib/organization/management-service'
import { roleUpdateSchema } from '@/lib/organization/schemas'

export async function PATCH(request: Request, { params }: { params: Promise<{ roleId: string }> }): Promise<NextResponse> { try { const input = roleUpdateSchema.safeParse(await request.json()); if (!input.success) return NextResponse.json({ error: 'ROLE_INPUT_INVALID' }, { status: 400 }); await updateRole((await params).roleId, input.data); return NextResponse.json({ data: { updated: true } }) } catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof OrganizationServiceError) return NextResponse.json({ error: error.code }, { status: error.status }); return NextResponse.json({ error: 'ROLE_UPDATE_FAILED' }, { status: 500 }) } }
