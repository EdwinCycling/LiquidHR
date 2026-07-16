import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { OrganizationServiceError, setRolePermissions } from '@/lib/organization/management-service'
import { rolePermissionsSchema } from '@/lib/organization/schemas'

export async function PUT(request: Request, { params }: { params: Promise<{ roleId: string }> }): Promise<NextResponse> { try { const input = rolePermissionsSchema.safeParse(await request.json()); if (!input.success) return NextResponse.json({ error: 'ROLE_PERMISSIONS_INPUT_INVALID' }, { status: 400 }); await setRolePermissions((await params).roleId, input.data.permissionIds); return NextResponse.json({ data: { updated: true } }) } catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof OrganizationServiceError) return NextResponse.json({ error: error.code }, { status: error.status }); return NextResponse.json({ error: 'ROLE_PERMISSIONS_WRITE_FAILED' }, { status: 500 }) } }
