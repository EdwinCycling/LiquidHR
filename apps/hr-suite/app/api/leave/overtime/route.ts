import { NextResponse } from 'next/server'
import { createOvertimeExceptions, leaveErrorResponse, updateOvertimeConfiguration } from '@/lib/leave/leave-service'
import { overtimeConfigurationMutationSchema } from '@/lib/leave/schemas'

export async function POST(request: Request) {
  try {
    const parsed = overtimeConfigurationMutationSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'LEAVE_INPUT_INVALID' }, { status: 400 })
    const input = parsed.data
    const data = input.action === 'OVERTIME_SETTINGS'
      ? await updateOvertimeConfiguration(input)
      : await createOvertimeExceptions(input)
    return NextResponse.json({ data }, { status: input.action === 'OVERTIME_EXCEPTION' ? 201 : 200 })
  } catch (error) {
    return leaveErrorResponse(error)
  }
}
