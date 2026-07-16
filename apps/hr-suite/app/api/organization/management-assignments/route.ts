import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createManagementAssignment, OrganizationServiceError } from '@/lib/organization/management-service'
import { managementAssignmentCreateSchema } from '@/lib/organization/schemas'
export async function POST(request: Request): Promise<NextResponse> { try { const input = managementAssignmentCreateSchema.safeParse(await request.json()); if (!input.success) return NextResponse.json({ error: 'MANAGEMENT_ASSIGNMENT_INPUT_INVALID' }, { status: 400 }); return NextResponse.json({ data: { id: await createManagementAssignment(input.data) } }, { status: 201 }) } catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof OrganizationServiceError) return NextResponse.json({ error: error.code }, { status: error.status }); return NextResponse.json({ error: 'MANAGEMENT_ASSIGNMENT_CREATE_FAILED' }, { status: 500 }) } }
