import { NextResponse } from 'next/server'
import { permissionErrorResponse, requireAnyPermission } from '@/lib/auth/permissions'
import { createEmployee } from '@/lib/employees/employee-service'
import { employeeErrorPayload } from '@/lib/employees/http-errors'
import { employeeCreateSchema } from '@/lib/employees/schemas'
import { listEmployeesOverview, listEmployeesOverviewPage } from '@/lib/employment/employment-service'

function errorResponse(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  const payload = employeeErrorPayload(error)
  return NextResponse.json(payload.body, { status: payload.status })
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const context = await requireAnyPermission(['employee:read', 'employee-directory:read'])
    const scope = context.activeRoles.includes('DIRECT_MANAGER') && !context.activeRoles.includes('TENANT_ADMIN')
      ? 'team'
      : 'all'
    const params = new URL(request.url).searchParams
    const search = params.get('search')?.trim() ?? ''

    if (!context.permissions.includes('employee:read')) {
      const requestedPage = params.get('page') === null ? 1 : Number(params.get('page'))
      if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || requestedPage > 1_000_000) {
        return NextResponse.json({ error: 'EMPLOYEE_OVERVIEW_PAGE_INVALID' }, { status: 400 })
      }

      const page = await listEmployeesOverviewPage({
        archiveFilter: 'active',
        statusFilter: 'ACTIVE_EMPLOYEE',
        search,
        sort: params.get('sort') === 'first-name' ? 'first-name' : 'last-name',
        scope,
        page: requestedPage,
      })
      if (!page.directoryAccess) {
        return NextResponse.json({ error: 'EMPLOYEE_DIRECTORY_UNAVAILABLE' }, { status: 403 })
      }

      return NextResponse.json({
        data: page.employees,
        totalCount: page.totalCount,
        page: page.page,
        pageSize: page.pageSize,
        directoryVisibility: page.directoryVisibility,
        directoryAccess: page.directoryAccess,
      })
    }

    const normalizedSearch = search.toLocaleLowerCase('nl')
    const employees = await listEmployeesOverview('active', scope)
    const data = normalizedSearch
      ? employees.filter((employee) => `${employee.employeeNumber} ${employee.firstName} ${employee.birthNamePrefix ?? ''} ${employee.birthName} ${employee.departmentName ?? ''} ${employee.jobTitle ?? ''} ${employee.workEmail ?? ''}`.toLocaleLowerCase('nl').includes(normalizedSearch))
      : employees
    return NextResponse.json({ data })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = employeeCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'EMPLOYEE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await createEmployee(parsed.data) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
