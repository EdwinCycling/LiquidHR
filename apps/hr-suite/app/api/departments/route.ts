import { NextResponse } from 'next/server'
import { permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { createDepartment, OrganizationServiceError } from '@/lib/organization/management-service'
import { departmentCreateSchema } from '@/lib/organization/schemas'
import { createClient } from '@/lib/supabase/server'

interface DepartmentNode {
  id: string
  code: string
  name: string
  description: string | null
  children: DepartmentNode[]
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = departmentCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'DEPARTMENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createDepartment(parsed.data) } }, { status: 201 })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof OrganizationServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'DEPARTMENT_CREATE_FAILED' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const context = await requirePermission('department:read')
    const supabase = await createClient()
    let query = supabase
      .from('departments')
      .select('id, code, name, description, parent_id')
      .eq('tenant_id', context.tenantId)
      .eq('is_active', true)

    if (context.administrationId) {
      query = query.eq('administration_id', context.administrationId)
    }

    const { data, error } = await query
      .order('name')
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const nodes = new Map<string, DepartmentNode>()
    const roots: DepartmentNode[] = []
    for (const department of data) {
      nodes.set(department.id, { ...department, children: [] })
    }
    for (const department of data) {
      const node = nodes.get(department.id)
      if (!node) continue
      const parent = department.parent_id ? nodes.get(department.parent_id) : undefined
      if (parent) parent.children.push(node)
      else roots.push(node)
    }

    return NextResponse.json({ data: roots })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    throw error
  }
}
