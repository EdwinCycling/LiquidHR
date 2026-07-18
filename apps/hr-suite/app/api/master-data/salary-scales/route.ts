import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { salaryScaleCreateSchema } from '@/lib/master-data/schemas'
import { createSalaryScale, listSalaryStructures, MasterDataError } from '@/lib/master-data/service'

function failure(error: unknown) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof MasterDataError) return NextResponse.json({ code: error.code }, { status: error.status }); return null }
export async function GET() { try { return NextResponse.json({ data: await listSalaryStructures() }) } catch (error) { const response = failure(error); if (response) return response; throw error } }
export async function POST(request: Request) { try { const parsed = salaryScaleCreateSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ code: 'MASTER_DATA_INPUT_INVALID' }, { status: 400 }); return NextResponse.json({ data: { id: await createSalaryScale(parsed.data) } }, { status: 201 }) } catch (error) { const response = failure(error); if (response) return response; throw error } }
