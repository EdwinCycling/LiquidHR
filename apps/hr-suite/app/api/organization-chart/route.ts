import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { OrganizationChartError, getOrganizationChart } from '@/lib/organization-chart/service'
import { organizationChartQuerySchema } from '@/lib/organization-chart/schemas'

function errorResponse(error: unknown): NextResponse | null {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof OrganizationChartError) return NextResponse.json({ code: error.code }, { status: error.status })
  return null
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const parameters = Object.fromEntries(new URL(request.url).searchParams)
    const parsed = organizationChartQuerySchema.safeParse({
      ...parameters,
      date: parameters.date ?? new Date().toISOString().slice(0, 10),
    })
    if (!parsed.success) return NextResponse.json({ code: 'ORGANIZATION_CHART_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await getOrganizationChart(parsed.data) })
  } catch (error) {
    const response = errorResponse(error)
    if (response) return response
    throw error
  }
}
