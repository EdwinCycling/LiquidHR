import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { CompanyDataServiceError, getCompanyDataSettings, updateCompanyData } from '@/lib/company-data/service'
import { companyDataUpdateSchema } from '@/lib/company-data/schemas'

export async function GET(): Promise<NextResponse> {
  try { return NextResponse.json({ data: await getCompanyDataSettings() }) }
  catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof CompanyDataServiceError) return NextResponse.json({ error: error.code }, { status: error.status }); return NextResponse.json({ error: 'COMPANY_DATA_READ_FAILED' }, { status: 500 }) }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const parsed = companyDataUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'COMPANY_DATA_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await updateCompanyData(parsed.data) })
  } catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof CompanyDataServiceError) return NextResponse.json({ error: error.code }, { status: error.status }); return NextResponse.json({ error: 'COMPANY_DATA_SAVE_FAILED' }, { status: 500 }) }
}
