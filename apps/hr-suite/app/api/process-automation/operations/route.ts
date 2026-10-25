import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { getLocale } from '@/lib/i18n/server'
import {
  getProcessOperationsInbox,
  ProcessOperationsServiceError,
  processOperationsQuerySchema,
} from '@/lib/process-automation/operations-service'

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams
  const parsed = processOperationsQuerySchema.safeParse({
    search: searchParams.get('search') ?? undefined,
    filter: searchParams.get('filter') ?? undefined,
    page: searchParams.has('page') ? Number(searchParams.get('page')) : undefined,
    pageSize: searchParams.has('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
  })
  if (!parsed.success) return NextResponse.json({ code: 'PROCESS_OPERATIONS_FILTER_INVALID' }, { status: 400 })

  try {
    const data = await getProcessOperationsInbox(parsed.data, await getLocale())
    return NextResponse.json({ data })
  } catch (error) {
    const authResponse = permissionErrorResponse(error)
    if (authResponse) return authResponse

    if (error instanceof ProcessOperationsServiceError) {
      return NextResponse.json({ code: error.code }, { status: error.status })
    }
    return NextResponse.json({ code: 'PROCESS_OPERATIONS_READ_FAILED' }, { status: 500 })
  }
}
