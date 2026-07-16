import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createRole, listAuthorizationMatrix, OrganizationServiceError } from '@/lib/organization/management-service'
import { roleCreateSchema } from '@/lib/organization/schemas'

function fail(error: unknown): NextResponse { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof OrganizationServiceError) return NextResponse.json({ error: error.code }, { status: error.status }); return NextResponse.json({ error: 'AUTHORIZATION_FAILED' }, { status: 500 }) }
export async function GET(): Promise<NextResponse> { try { return NextResponse.json({ data: await listAuthorizationMatrix() }) } catch (error) { return fail(error) } }
export async function POST(request: Request): Promise<NextResponse> { try { const input = roleCreateSchema.safeParse(await request.json()); if (!input.success) return NextResponse.json({ error: 'ROLE_INPUT_INVALID' }, { status: 400 }); return NextResponse.json({ data: { id: await createRole(input.data) } }, { status: 201 }) } catch (error) { return fail(error) } }
