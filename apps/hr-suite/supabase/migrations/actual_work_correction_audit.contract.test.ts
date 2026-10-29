import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./20261026100906_pay_w04_hr_hours_to_payroll.sql', import.meta.url), 'utf8')
const guardStart = migration.indexOf('create or replace function internal_security.require_actual_work_correction_audit()')
const guardEnd = migration.indexOf('revoke all on function internal_security.prepare_actual_work_payroll_mapping_version()', guardStart)
const correctionGuardSql = migration.slice(guardStart, guardEnd)

const tenantId = '11111111-1111-4111-8111-111111111111'
const groupId = '22222222-2222-4222-8222-222222222222'
const administrationId = '33333333-3333-4333-8333-333333333333'
const employeeId = '44444444-4444-4444-8444-444444444444'
const employmentId = '55555555-5555-4555-8555-555555555555'
const entryId = '66666666-6666-4666-8666-666666666666'
const actorId = '77777777-7777-4777-8777-777777777777'
const typeId = '88888888-8888-4888-8888-888888888888'
const changedAt = '2026-10-26T12:00:00.000Z'

async function createDatabase(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create schema internal_security;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('app.actor_id', true), '')::uuid
    $$;
    create table public.employment_work_hour_entries (
      id uuid primary key,
      tenant_id uuid not null,
      hr_group_id uuid not null,
      administration_id uuid not null,
      employee_id uuid not null,
      employment_id uuid not null,
      work_hour_type_id uuid not null,
      work_date date not null,
      entry_granularity text not null,
      subject_period_start date not null,
      subject_period_end date not null,
      posting_period_start date not null,
      hours numeric not null,
      note text,
      status text not null,
      updated_at timestamptz not null
    );
    create table public.actual_work_revisions (
      tenant_id uuid not null,
      hr_group_id uuid not null,
      administration_id uuid not null,
      employee_id uuid not null,
      employment_id uuid not null,
      entry_id uuid not null,
      operation text not null,
      reason text,
      actor_user_id uuid not null,
      created_at timestamptz not null,
      subject_period_start date not null,
      subject_period_end date not null,
      posting_period_start date not null,
      previous_hours numeric,
      current_hours numeric
    );
  `)
  await db.exec(correctionGuardSql)
  await db.query("select set_config('app.actor_id', $1, false)", [actorId])
  await db.query(`
    insert into public.employment_work_hour_entries (
      id, tenant_id, hr_group_id, administration_id, employee_id, employment_id, work_hour_type_id,
      work_date, entry_granularity, subject_period_start, subject_period_end, posting_period_start,
      hours, note, status, updated_at
    ) values ($1,$2,$3,$4,$5,$6,$7,'2026-10-05','DAY','2026-10-05','2026-10-06','2026-10-01',8,'original','APPROVED','2026-10-25T12:00:00Z')
  `, [entryId, tenantId, groupId, administrationId, employeeId, employmentId, typeId])
  return db
}

describe('Actual Work correction audit deferred constraint', () => {
  it('rejects a direct data edit without a same-transaction correction revision', async () => {
    const db = await createDatabase()
    try {
      await db.exec('begin')
      await db.query('update public.employment_work_hour_entries set hours = 9, updated_at = $1 where id = $2', [changedAt, entryId])
      await expect(db.exec('commit')).rejects.toThrow('ACTUAL_WORK_CORRECTION_REASON_REQUIRED')
      await db.exec('rollback')

      const row = await db.query<{ hours: number }>('select hours::double precision as hours from public.employment_work_hour_entries where id = $1', [entryId])
      expect(row.rows[0]?.hours).toBe(8)
    } finally {
      await db.close()
    }
  })

  it('accepts an edited entry when its exact actor, period, hours, timestamp and reason are audited', async () => {
    const db = await createDatabase()
    try {
      await db.exec('begin')
      await db.query('update public.employment_work_hour_entries set hours = 9, updated_at = $1 where id = $2', [changedAt, entryId])
      await db.query(`
        insert into public.actual_work_revisions (
          tenant_id, hr_group_id, administration_id, employee_id, employment_id, entry_id,
          operation, reason, actor_user_id, created_at, subject_period_start, subject_period_end,
          posting_period_start, previous_hours, current_hours
        ) values ($1,$2,$3,$4,$5,$6,'CORRECTION','Urenstaat gecontroleerd',$7,$8,'2026-10-05','2026-10-06','2026-10-01',8,9)
      `, [tenantId, groupId, administrationId, employeeId, employmentId, entryId, actorId, changedAt])
      await db.exec('commit')

      const row = await db.query<{ hours: number }>('select hours::double precision as hours from public.employment_work_hour_entries where id = $1', [entryId])
      expect(row.rows[0]?.hours).toBe(9)
    } finally {
      await db.close()
    }
  })
})
