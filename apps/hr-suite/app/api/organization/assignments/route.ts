import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { listOrganizationAssignments, OrganizationServiceError } from '@/lib/organization/management-service'
export async function GET(): Promise<NextResponse> { try { return NextResponse.json({ data: await listOrganizationAssignments() }) } catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof OrganizationServiceError) return NextResponse.json({ error: error.code }, { status: error.status }); return NextResponse.json({ error: 'ORGANIZATION_ASSIGNMENTS_READ_FAILED' }, { status: 500 }) } }
