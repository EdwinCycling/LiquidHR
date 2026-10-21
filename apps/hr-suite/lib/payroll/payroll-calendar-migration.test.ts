import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { describe, expect, it } from 'vitest'
import { generatePayrollCalendar, type PayrollCalendarDefinition } from './payroll-calendar'

const migration = readFileSync(new URL('./supabase/migrations/20261014105333_payroll_calendar_foundation.sql', import.meta.url), 'utf8')

const payrollCatalog = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE public.payroll_administrations (
  id uuid PRIMARY KEY,
  source_tenant_id uuid NOT NULL,
  source_hr_group_id uuid NOT NULL,
  source_administration_id uuid NOT NULL,
  UNIQUE (id, source_tenant_id, source_hr_group_id, source_administration_id)
);
CREATE TABLE public.payroll_periods (
  id uuid PRIMARY KEY,
  payroll_administration_id uuid NOT NULL,
  source_tenant_id uuid NOT NULL,
  source_hr_group_id uuid NOT NULL,
  source_administration_id uuid NOT NULL,
  period_year smallint NOT NULL,
  period_month smallint NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid,
  UNIQUE (id, source_tenant_id, source_hr_group_id, source_administration_id),
  CONSTRAINT payroll_periods_month_unique UNIQUE (source_tenant_id, source_hr_group_id, source_administration_id, period_year, period_month)
);
CREATE TABLE public.calculation_input_sets (
  id uuid PRIMARY KEY,
  payroll_period_id uuid NOT NULL
);
CREATE TABLE public.calculation_runs (
  id uuid PRIMARY KEY,
  calculation_input_set_id uuid NOT NULL
);
`

const admin = {
  id: '10000000-0000-4000-8000-000000000001',
  tenant: '20000000-0000-4000-8000-000000000002',
  group: '30000000-0000-4000-8000-000000000003',
  sourceAdmin: '40000000-0000-4000-8000-000000000004',
}
const regularPeriodId = '50000000-0000-4000-8000-000000000005'
const calendarId = '60000000-0000-4000-8000-000000000006'
const weeklyPeriodIds = [
  '70000000-0000-4000-8000-000000000007',
  '80000000-0000-4000-8000-000000000008',
]
const additionalPeriodId = '90000000-0000-4000-8000-000000000010'
const correctionPeriodId = '90000000-0000-4000-8000-000000000011'

describe('Payroll Calendar migration contract', () => {
  it('preserves legacy months, scopes new periods, separates declaration periods, and locks referenced history', async () => {
    const db = new PGlite({ extensions: { pgcrypto } })
    try {
      await db.exec('CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;')
      await db.exec(payrollCatalog)
      await db.query(
        `INSERT INTO public.payroll_administrations VALUES ($1, $2, $3, $4)`,
        [admin.id, admin.tenant, admin.group, admin.sourceAdmin],
      )
      await db.query(
        `INSERT INTO public.payroll_periods (
          id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
          period_year, period_month, starts_on, ends_on, status
        ) VALUES ($1, $2, $3, $4, $5, 2026, 10, '2026-10-01', '2026-10-31', 'OPEN')`,
        [regularPeriodId, admin.id, admin.tenant, admin.group, admin.sourceAdmin],
      )
      await db.exec(migration)

      const legacy = await db.query<{ period_month: number; periodicity: string; period_kind: string; calendar_id: string | null }>(
        `SELECT period_month, periodicity, period_kind, calendar_id FROM public.payroll_periods WHERE id = $1`,
        [regularPeriodId],
      )
      expect(legacy.rows[0]).toEqual({ period_month: 10, periodicity: 'MONTHLY', period_kind: 'REGULAR', calendar_id: null })

      await db.query(
        `INSERT INTO public.payroll_calendars (
          id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
          calendar_code, display_name, periodicity, calendar_year, version, effective_from, effective_to,
          anchor_date, year_assignment, payment_date_rule, processing_deadline_rule, status
        ) VALUES ($1,$2,$3,$4,$5,'WEEKLY-2026','Wekelijkse salarisverwerking','WEEKLY',2026,1,'2025-12-26','2026-12-31','2025-12-26','PERIOD_END',
          '{"kind":"PERIOD_END_OFFSET_DAYS","days":5}'::jsonb,'{"kind":"PERIOD_END_OFFSET_DAYS","days":1}'::jsonb,'DRAFT')`,
        [calendarId, admin.id, admin.tenant, admin.group, admin.sourceAdmin],
      )
      for (const [index, id] of weeklyPeriodIds.entries()) {
        const startsOn = index === 0 ? '2026-12-18' : '2026-12-25'
        const endsOn = index === 0 ? '2026-12-24' : '2026-12-31'
        await db.query(
          `INSERT INTO public.payroll_periods (
            id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
            period_year, period_month, starts_on, ends_on, planned_payment_date, processing_deadline, status, calendar_id, period_number, periodicity,
            calendar_snapshot, calendar_hash
          ) VALUES ($1,$2,$3,$4,$5,2026,NULL,$6,$7,$8,$9,'DRAFT',$10,$11,'WEEKLY','{"periodicity":"WEEKLY"}'::jsonb,$12)`,
          [id, admin.id, admin.tenant, admin.group, admin.sourceAdmin, startsOn, endsOn,
            index === 0 ? '2026-12-29' : '2027-01-05', index === 0 ? '2026-12-25' : '2027-01-01',
            calendarId, 52 + index, 'a'.repeat(64)],
        )
      }

      const canonicalSnapshot = await db.query<{
        calendar_snapshot: Record<string, unknown>
        calendar_hash: string
        calculated_hash: string
      }>(
        `SELECT calendar_snapshot, calendar_hash,
          encode(extensions.digest(convert_to(calendar_snapshot::text, 'UTF8'), 'sha256'), 'hex') AS calculated_hash
         FROM public.payroll_periods WHERE id = $1`,
        [weeklyPeriodIds[0]],
      )
      expect(canonicalSnapshot.rows[0]?.calendar_snapshot).toMatchObject({
        calendarCode: 'WEEKLY-2026',
        calendarYear: 2026,
        periodNumber: 52,
        startsOn: '2026-12-18',
        endsOn: '2026-12-24',
        plannedPaymentDate: '2026-12-29',
        processingDeadline: '2026-12-25',
      })
      expect(canonicalSnapshot.rows[0]?.calendar_hash).toBe(canonicalSnapshot.rows[0]?.calculated_hash)

      await expect(db.query(
        `INSERT INTO public.payroll_periods (
          id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
          period_year, period_month, starts_on, ends_on, planned_payment_date, processing_deadline,
          status, calendar_id, period_number, periodicity
        ) VALUES ('c0000000-0000-4000-8000-000000000003',$1,$2,$3,$4,2026,NULL,
          '2026-12-19','2026-12-25','2026-12-30','2026-12-26','DRAFT',$5,52,'WEEKLY')`,
        [admin.id, admin.tenant, admin.group, admin.sourceAdmin, calendarId],
      )).rejects.toThrow('boundaries do not match')
      await expect(db.query(
        `INSERT INTO public.payroll_periods (
          id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
          period_year, period_month, starts_on, ends_on, planned_payment_date, processing_deadline,
          status, calendar_id, period_number, periodicity
        ) VALUES ('c0000000-0000-4000-8000-000000000004',$1,$2,$3,$4,2026,NULL,
          '2026-12-25','2026-12-31','2027-01-06','2027-01-01','DRAFT',$5,53,'WEEKLY')`,
        [admin.id, admin.tenant, admin.group, admin.sourceAdmin, calendarId],
      )).rejects.toThrow('planned payment date does not match')

      await db.query(
        `INSERT INTO public.payroll_periods (
          id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
          period_year, period_month, starts_on, ends_on, status, period_number, periodicity, period_kind
        ) VALUES ($1,$2,$3,$4,$5,2026,NULL,'2026-12-18','2026-12-24','DRAFT',1,'AD_HOC','ADDITIONAL')`,
        [additionalPeriodId, admin.id, admin.tenant, admin.group, admin.sourceAdmin],
      )
      await db.query(
        `INSERT INTO public.payroll_periods (
          id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
          period_year, period_month, starts_on, ends_on, status, period_number, periodicity, period_kind,
            correction_of_period_id, supersedes_period_id
        ) VALUES ($1,$2,$3,$4,$5,2026,NULL,'2026-12-18','2026-12-24','DRAFT',1,'AD_HOC','CORRECTION',$6,$6)`,
        [correctionPeriodId, admin.id, admin.tenant, admin.group, admin.sourceAdmin, weeklyPeriodIds[0]],
      )
      await expect(db.query(
        `INSERT INTO public.payroll_periods (
          id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
          period_year, period_month, starts_on, ends_on, status, period_number, periodicity, period_kind,
          correction_of_period_id, supersedes_period_id
        ) VALUES ('c0000000-0000-4000-8000-000000000005',$1,$2,$3,$4,2026,NULL,'2026-12-18','2026-12-24',
          'DRAFT',2,'AD_HOC','CORRECTION',$5,$6)`,
        [admin.id, admin.tenant, admin.group, admin.sourceAdmin, weeklyPeriodIds[0], additionalPeriodId],
      )).rejects.toThrow('supersede only a regular period or an earlier correction')
      await expect(db.query(
        `INSERT INTO public.payroll_periods (
          id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
          period_year, period_month, starts_on, ends_on, status, period_number, periodicity, period_kind
        ) VALUES ('c0000000-0000-4000-8000-000000000006',$1,$2,$3,$4,2026,NULL,'2026-12-18','2026-12-24',
          'DRAFT',1,'AD_HOC','ADDITIONAL')`,
        [admin.id, admin.tenant, admin.group, admin.sourceAdmin],
      )).rejects.toThrow('payroll_periods_ad_hoc_identity_unique')

      await db.query(
        `INSERT INTO public.payroll_declaration_periods (
          payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
          tax_registration_reference, filing_frequency, starts_on, ends_on, statutory_period_code
        ) VALUES ($1,$2,$3,$4,'tax-registration-source','MONTHLY','2026-12-01','2026-12-31','2026-12')`,
        [admin.id, admin.tenant, admin.group, admin.sourceAdmin],
      )
      const declaration = await db.query<{ id: string }>(`SELECT id FROM public.payroll_declaration_periods`)
      for (const payrollPeriodId of weeklyPeriodIds) {
        await db.query(
          `INSERT INTO public.payroll_declaration_period_payroll_periods (
            declaration_period_id, payroll_period_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id
          ) VALUES ($1,$2,$3,$4,$5,$6)`,
          [declaration.rows[0]?.id, payrollPeriodId, admin.id, admin.tenant, admin.group, admin.sourceAdmin],
        )
      }

      await db.query(`INSERT INTO public.calculation_input_sets VALUES ('90000000-0000-4000-8000-000000000009',$1)`, [weeklyPeriodIds[0]])
      await db.query(`INSERT INTO public.calculation_runs VALUES ('a0000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000009')`)
      await db.query(`INSERT INTO public.calculation_runs VALUES ('b0000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000009')`)
      await expect(db.query(`UPDATE public.payroll_periods SET starts_on = '2026-12-17' WHERE id = $1`, [weeklyPeriodIds[0]])).rejects.toThrow('identity is immutable')
      await expect(db.query(`UPDATE public.payroll_calendars SET payment_date_rule = '{"kind":"PERIOD_END_OFFSET_DAYS","days":6}' WHERE id = $1`, [calendarId])).rejects.toThrow('cannot be changed')

      await db.query(`UPDATE public.payroll_calendars SET status = 'ACTIVE' WHERE id = $1`, [calendarId])
      await expect(db.query(
        `INSERT INTO public.payroll_calendars (
          id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
          calendar_code, display_name, periodicity, calendar_year, version, effective_from, effective_to,
          anchor_date, year_assignment, status
        ) VALUES ('e0000000-0000-4000-8000-000000000005',$1,$2,$3,$4,'WEEKLY-2026','Overlappende jaarversie',
          'WEEKLY',2027,1,'2026-12-31','2027-12-31','2026-12-25','PERIOD_END','ACTIVE')`,
        [admin.id, admin.tenant, admin.group, admin.sourceAdmin],
      )).rejects.toThrow('overlapping effective dates')
      await db.query(
        `INSERT INTO public.payroll_calendars (
          id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
          calendar_code, display_name, periodicity, calendar_year, version, effective_from, effective_to,
          anchor_date, year_assignment, status
        ) VALUES ('f0000000-0000-4000-8000-000000000005',$1,$2,$3,$4,'TEMP-CODE-2027','Tijdelijke jaarversie',
          'WEEKLY',2027,1,'2026-12-31','2027-12-31','2026-12-25','PERIOD_END','ACTIVE')`,
        [admin.id, admin.tenant, admin.group, admin.sourceAdmin],
      )
      await expect(db.query(
        `UPDATE public.payroll_calendars SET calendar_code = 'WEEKLY-2026'
         WHERE id = 'f0000000-0000-4000-8000-000000000005'`,
      )).rejects.toThrow('overlapping effective dates')

      const declarationLinks = await db.query<{ count: number }>(
        `SELECT count(*)::integer AS count FROM public.payroll_declaration_period_payroll_periods`,
      )
      expect(declarationLinks.rows[0]?.count).toBe(2)
      const nonMonthly = await db.query<{ period_month: number | null; period_number: number; starts_on: string; ends_on: string }>(
        `SELECT period_month, period_number, starts_on::text, ends_on::text FROM public.payroll_periods WHERE id = $1`,
        [weeklyPeriodIds[0]],
      )
      expect(nonMonthly.rows[0]).toEqual({ period_month: null, period_number: 52, starts_on: '2026-12-18', ends_on: '2026-12-24' })
      const adHocPeriods = await db.query<{ id: string; period_kind: string; period_month: number | null }>(
        `SELECT id, period_kind, period_month FROM public.payroll_periods WHERE id IN ($1, $2) ORDER BY period_kind`,
        [additionalPeriodId, correctionPeriodId],
      )
      expect(adHocPeriods.rows).toEqual([
        { id: additionalPeriodId, period_kind: 'ADDITIONAL', period_month: null },
        { id: correctionPeriodId, period_kind: 'CORRECTION', period_month: null },
      ])
      const calendarAudit = await db.query<{ count: number }>(`SELECT count(*)::integer AS count FROM public.payroll_calendar_events`)
      expect(calendarAudit.rows[0]?.count).toBe(3)

      const protectedTables = await db.query<{ relname: string; relrowsecurity: boolean }>(
        `SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace
          AND relname IN ('payroll_calendars','payroll_calendar_events','payroll_declaration_periods','payroll_declaration_period_payroll_periods')
          ORDER BY relname`,
      )
      expect(protectedTables.rows).toHaveLength(4)
      expect(protectedTables.rows.every((row) => row.relrowsecurity)).toBe(true)
      await db.exec('GRANT SELECT ON public.payroll_calendars TO authenticated; SET ROLE authenticated;')
      const hiddenCalendars = await db.query<{ count: number }>(`SELECT count(*)::integer AS count FROM public.payroll_calendars`)
      expect(hiddenCalendars.rows[0]?.count).toBe(0)
      await db.exec('RESET ROLE; SET ROLE service_role;')
      const visibleCalendars = await db.query<{ count: number }>(`SELECT count(*)::integer AS count FROM public.payroll_calendars`)
      expect(visibleCalendars.rows[0]?.count).toBe(2)
      await db.exec('RESET ROLE;')
    } finally {
      await db.close()
    }
  })

  it('accepts database boundaries generated for every supported payroll periodicity', async () => {
    const db = new PGlite({ extensions: { pgcrypto } })
    const calendarDefinitions: readonly PayrollCalendarDefinition[] = [
      {
        scopeKey: 'admin', calendarCode: 'MONTHLY-2026', name: 'Maandelijks', version: 1, periodicity: 'MONTHLY',
        calendarYear: 2026, effectiveFrom: '2025-01-01', effectiveTo: '2028-12-31',
        paymentDateRule: { kind: 'MONTH_DAY', monthsAfterPeriodEnd: 0, dayOfMonth: 31, shortMonth: 'LAST_DAY' },
      },
      ...(['FOUR_WEEKLY', 'WEEKLY', 'BIWEEKLY'] as const).map((periodicity, index) => ({
        scopeKey: 'admin', calendarCode: `${periodicity}-2026`, name: periodicity, version: 1, periodicity,
        calendarYear: 2026, effectiveFrom: '2025-01-01', effectiveTo: '2028-12-31',
        anchorDate: '2025-12-26', yearAssignment: index === 1 ? 'PERIOD_START' as const : 'PERIOD_END' as const,
      })),
      ...(['QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'] as const).map((periodicity) => ({
        scopeKey: 'admin', calendarCode: `${periodicity}-2026`, name: periodicity, version: 1, periodicity,
        calendarYear: 2026, effectiveFrom: '2025-01-01', effectiveTo: '2028-12-31',
      })),
    ]

    try {
      await db.exec('CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;')
      await db.exec(payrollCatalog)
      await db.query(
        `INSERT INTO public.payroll_administrations VALUES ($1, $2, $3, $4)`,
        [admin.id, admin.tenant, admin.group, admin.sourceAdmin],
      )
      await db.exec(migration)

      let periodIdCounter = 101
      for (const [calendarIndex, definition] of calendarDefinitions.entries()) {
        const calendarIdForCase = `61000000-0000-4000-8000-${String(calendarIndex + 101).padStart(12, '0')}`
        await db.query(
          `INSERT INTO public.payroll_calendars (
            id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
            calendar_code, display_name, periodicity, calendar_year, version, effective_from, effective_to,
            anchor_date, year_assignment, payment_date_rule
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)`,
          [
            calendarIdForCase, admin.id, admin.tenant, admin.group, admin.sourceAdmin, definition.calendarCode,
            definition.name, definition.periodicity, definition.calendarYear, definition.version,
            definition.effectiveFrom, definition.effectiveTo, definition.anchorDate ?? null,
            definition.yearAssignment ?? null, definition.paymentDateRule ? JSON.stringify(definition.paymentDateRule) : null,
          ],
        )

        const generatedPeriods = generatePayrollCalendar(definition)
        for (const period of generatedPeriods) {
          const id = `71000000-0000-4000-8000-${String(periodIdCounter).padStart(12, '0')}`
          periodIdCounter += 1
          await db.query(
            `INSERT INTO public.payroll_periods (
              id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
              period_year, period_month, starts_on, ends_on, planned_payment_date, processing_deadline,
              status, calendar_id, period_number, periodicity
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'DRAFT',$12,$13,$14)`,
            [
              id, admin.id, admin.tenant, admin.group, admin.sourceAdmin, period.calendarYear,
              definition.periodicity === 'MONTHLY' ? period.periodNumber : null, period.startsOn, period.endsOn,
              period.plannedPaymentDate, period.processingDeadline, calendarIdForCase, period.periodNumber,
              period.periodicity,
            ],
          )
        }

        const persistedCount = await db.query<{ count: number }>(
          `SELECT count(*)::integer AS count FROM public.payroll_periods WHERE calendar_id = $1`,
          [calendarIdForCase],
        )
        expect(persistedCount.rows[0]?.count).toBe(generatedPeriods.length)
      }

      const invalidRuleCalendars = [
        {
          id: '62000000-0000-4000-8000-000000000201', periodId: '72000000-0000-4000-8000-000000000201',
          code: 'MISSING-OFFSET', periodicity: 'WEEKLY', calendarMonth: null, periodNumber: 52,
          startsOn: '2026-12-18', endsOn: '2026-12-24', paymentDate: null, deadline: null,
          anchor: '2025-12-26', assignment: 'PERIOD_END', paymentRule: { kind: 'PERIOD_END_OFFSET_DAYS' },
          deadlineRule: null, expectedError: 'requires a numeric day offset',
        },
        {
          id: '62000000-0000-4000-8000-000000000202', periodId: '72000000-0000-4000-8000-000000000202',
          code: 'MISSING-DEADLINE', periodicity: 'WEEKLY', calendarMonth: null, periodNumber: 52,
          startsOn: '2026-12-18', endsOn: '2026-12-24', paymentDate: null, deadline: null,
          anchor: '2025-12-26', assignment: 'PERIOD_END', paymentRule: null,
          deadlineRule: { kind: 'PERIOD_END_OFFSET_DAYS' }, expectedError: 'processing deadline rule requires a numeric day offset',
        },
        {
          id: '62000000-0000-4000-8000-000000000203', periodId: '72000000-0000-4000-8000-000000000203',
          code: 'MISSING-MONTH-DAY', periodicity: 'MONTHLY', calendarMonth: 1, periodNumber: 1,
          startsOn: '2026-01-01', endsOn: '2026-01-31', paymentDate: null, deadline: null,
          anchor: null, assignment: null, paymentRule: { kind: 'MONTH_DAY', shortMonth: 'LAST_DAY' },
          deadlineRule: null, expectedError: 'monthly payment date rule is incomplete',
        },
      ] as const
      for (const invalidRule of invalidRuleCalendars) {
        await db.query(
          `INSERT INTO public.payroll_calendars (
            id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
            calendar_code, display_name, periodicity, calendar_year, version, effective_from, effective_to,
            anchor_date, year_assignment, payment_date_rule, processing_deadline_rule
          ) VALUES ($1,$2,$3,$4,$5,$6,$6,$7,2026,1,'2025-01-01','2028-12-31',$8,$9,$10::jsonb,$11::jsonb)`,
          [
            invalidRule.id, admin.id, admin.tenant, admin.group, admin.sourceAdmin, invalidRule.code,
            invalidRule.periodicity, invalidRule.anchor, invalidRule.assignment,
            invalidRule.paymentRule ? JSON.stringify(invalidRule.paymentRule) : null,
            invalidRule.deadlineRule ? JSON.stringify(invalidRule.deadlineRule) : null,
          ],
        )
        await expect(db.query(
          `INSERT INTO public.payroll_periods (
            id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
            period_year, period_month, starts_on, ends_on, planned_payment_date, processing_deadline,
            status, calendar_id, period_number, periodicity
          ) VALUES ($1,$2,$3,$4,$5,2026,$6,$7,$8,$9,$10,'DRAFT',$11,$12,$13)`,
          [
            invalidRule.periodId, admin.id, admin.tenant, admin.group, admin.sourceAdmin,
            invalidRule.calendarMonth, invalidRule.startsOn, invalidRule.endsOn, invalidRule.paymentDate,
            invalidRule.deadline, invalidRule.id, invalidRule.periodNumber, invalidRule.periodicity,
          ],
        )).rejects.toThrow(invalidRule.expectedError)
      }
    } finally {
      await db.close()
    }
  })
})
