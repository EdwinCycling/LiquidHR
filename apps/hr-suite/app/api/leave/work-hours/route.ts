import { NextResponse } from 'next/server'
import { createWorkHourExceptions, leaveErrorResponse, updateWorkHourSettings } from '@/lib/leave/leave-service'
import { workHourConfigurationMutationSchema } from '@/lib/leave/schemas'

export async function POST(request: Request) {
  try {
    const parsed = workHourConfigurationMutationSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'LEAVE_INPUT_INVALID' }, { status: 400 })
    if (parsed.data.action === 'WORK_HOUR_SETTINGS') return NextResponse.json({ data: await updateWorkHourSettings(parsed.data) })
    return NextResponse.json({ data: await createWorkHourExceptions(parsed.data) }, { status: 201 })
  } catch (error) {
    return leaveErrorResponse(error)
  }
}
