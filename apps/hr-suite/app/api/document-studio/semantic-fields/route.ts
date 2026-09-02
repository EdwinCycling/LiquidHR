import { NextResponse } from 'next/server'
import { permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'

const SEMANTIC_FIELDS = [
  { key: 'employee.first_name', messageKey: 'documentStudio.semanticFields.employeeFirstName' },
  { key: 'employee.last_name', messageKey: 'documentStudio.semanticFields.employeeLastName' },
  { key: 'employee.employee_number', messageKey: 'documentStudio.semanticFields.employeeNumber' },
  { key: 'employment.start_date', messageKey: 'documentStudio.semanticFields.employmentStartDate' },
] as const

export async function GET() {
  try { await requirePermission('document-template:read'); return NextResponse.json({ data: SEMANTIC_FIELDS }) } catch (error) { const response = permissionErrorResponse(error); if (response) return response; throw error }
}
