import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { applySalaryApplicationChange, SalaryApplicationError } from '@/lib/salary-application/service'
import { databaseUuid } from '@/lib/validation/database-uuid'

const money = z.union([
  z.string().regex(/^\d{1,12}\.\d{2}$/),
  z.number().nonnegative().transform((value) => value.toFixed(2)),
])
const hourlyMoney = z.union([
  z.string().regex(/^\d{1,10}\.\d{4}$/),
  z.number().nonnegative().transform((value) => value.toFixed(4)),
])
const base = z.object({
  effectiveOn: z.string().date(),
  reason: z.string().trim().min(1).max(500),
  paymentType: z.enum(['PERIODIC_FIXED', 'HOURLY_VARIABLE']),
  paymentFrequency: z.enum(['MONTHLY', 'FOUR_WEEKLY']),
  fulltimeAmount: money.nullish(),
  parttimeAmount: money.nullish(),
  hourlyRate: hourlyMoney.nullish(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/).default('EUR'),
  warningCodes: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  acknowledgements: z.record(z.string(), z.boolean()).default({}),
}).strict()

const payload = z.discriminatedUnion('salaryRoute', [
  base.extend({ salaryRoute: z.literal('MANUAL') }),
  base.extend({ salaryRoute: z.literal('MINIMUM_WAGE'), minimumWageScheme: z.enum(['REGULAR', 'BBL']) }),
  base.extend({
    salaryRoute: z.literal('SCALE_WITH_STEPS'),
    salaryStructureId: databaseUuid,
    salaryScaleId: databaseUuid,
    salaryStepCode: z.string().trim().min(1).max(40),
    salaryScaleStepId: databaseUuid.nullish(),
    fulltimeAmount: money,
  }),
  base.extend({
    salaryRoute: z.literal('SALARY_BAND'),
    salaryStructureId: databaseUuid,
    salaryBandId: databaseUuid,
    fulltimeAmount: money,
  }),
])

function failure(error: unknown): NextResponse | null {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof SalaryApplicationError) return NextResponse.json({ code: error.code }, { status: error.status })
  return null
}

export async function POST(request: Request, context: { params: Promise<{ employmentId: string }> }): Promise<NextResponse> {
  try {
    const { employmentId } = await context.params
    if (!databaseUuid.safeParse(employmentId).success) return NextResponse.json({ code: 'SALARY_APPLICATION_INPUT_INVALID' }, { status: 400 })
    const parsed = payload.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'SALARY_APPLICATION_INPUT_INVALID' }, { status: 400 })
    const { effectiveOn, reason, warningCodes, acknowledgements, ...salaryPayload } = parsed.data
    const result = await applySalaryApplicationChange({
      employmentId,
      effectiveOn,
      reason,
      warningCodes,
      acknowledgements,
      payload: salaryPayload,
    })
    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    const response = failure(error)
    if (response) return response
    throw error
  }
}
