import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AuthenticationError, AuthorizationError, permissionErrorResponse } from '@/lib/auth/permissions'
import { listProcessWork, processWorkErrorResponse } from '@/lib/process-automation/work-service'

const querySchema = z.object({
  hrGroupId: z.string().uuid().optional(),
  administrationId: z.string().uuid().optional(),
  tab: z.enum(['TODO', 'CLAIMED', 'WAITING', 'COMPLETED', 'ALL']).default('TODO'),
  search: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  processDefinitionId: z.string().uuid().optional(),
  subjectEmployeeId: z.string().uuid().optional(),
  language: z.enum(['nl', 'en']).default('nl'),
  sort: z.enum(['NEEDS_ACTION', 'DEADLINE']).default('NEEDS_ACTION'),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
}).strict()

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
    if (!parsed.success) return NextResponse.json({ code: 'INVALID_PROCESS_WORK_QUERY' }, { status: 400 })
    const data = await listProcessWork(parsed.data)
    return NextResponse.json({ data })
  } catch (error) {
    return processWorkErrorResponse(error)
      ?? permissionErrorResponse(error)
      ?? (error instanceof AuthenticationError || error instanceof AuthorizationError
        ? NextResponse.json({ code: 'FORBIDDEN' }, { status: error.status })
        : NextResponse.json({ code: 'PROCESS_WORK_READ_FAILED' }, { status: 500 }))
  }
}
