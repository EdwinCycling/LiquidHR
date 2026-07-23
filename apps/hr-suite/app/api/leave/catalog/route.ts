import { NextResponse } from 'next/server'
import { assignLeaveProfile, createLeaveAccrualRule, createLeaveBonusRule, createLeaveCatalogItem, createLeaveException, createLeavePriorityRule, leaveErrorResponse, listLeaveCatalog, updateLeaveCatalogItem, updateLeavePriorityRule } from '@/lib/leave/leave-service'
import { leaveCatalogMutationSchema, leaveConfigurationMutationSchema } from '@/lib/leave/schemas'

export async function GET() {
  try {
    return NextResponse.json({ data: await listLeaveCatalog() })
  } catch (error) {
    return leaveErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const catalogParsed = leaveCatalogMutationSchema.safeParse(body)
    if (catalogParsed.success) return NextResponse.json({ data: await createLeaveCatalogItem(catalogParsed.data) }, { status: 201 })
    const configurationParsed = leaveConfigurationMutationSchema.safeParse(body)
    if (!configurationParsed.success) return NextResponse.json({ error: 'LEAVE_INPUT_INVALID' }, { status: 400 })
    const input = configurationParsed.data
    if (input.action === 'UPDATE_LEAVE_TYPE' || input.action === 'UPDATE_WORK_HOUR_TYPE' || input.action === 'UPDATE_PROFILE' || input.action === 'ARCHIVE_LEAVE_TYPE' || input.action === 'ARCHIVE_WORK_HOUR_TYPE' || input.action === 'ARCHIVE_PROFILE') {
      return NextResponse.json({ data: await updateLeaveCatalogItem(input) })
    }
    if (input.action === 'ACCRUAL_RULE') return NextResponse.json({ data: await createLeaveAccrualRule(input) }, { status: 201 })
    if (input.action === 'ACCRUAL_EXCEPTION') return NextResponse.json({ data: await createLeaveException(input) }, { status: 201 })
    if (input.action === 'BONUS_RULE') return NextResponse.json({ data: await createLeaveBonusRule(input) }, { status: 201 })
    if (input.action === 'PRIORITY_RULE') return NextResponse.json({ data: await createLeavePriorityRule(input) }, { status: 201 })
    if (input.action === 'UPDATE_PRIORITY_RULE') return NextResponse.json({ data: await updateLeavePriorityRule(input) })
    if (input.action === 'PROFILE_ASSIGNMENT') return NextResponse.json({ data: await assignLeaveProfile(input) }, { status: 201 })
    return NextResponse.json({ error: 'LEAVE_CONFIGURATION_ACTION_NOT_AVAILABLE' }, { status: 501 })
  } catch (error) {
    return leaveErrorResponse(error)
  }
}
