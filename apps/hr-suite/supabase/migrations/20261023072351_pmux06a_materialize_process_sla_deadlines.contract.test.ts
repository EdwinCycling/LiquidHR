import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'

const migrationUrl = new URL('./20261023072351_pmux06a_materialize_process_sla_deadlines.sql', import.meta.url)
const tenantA = '00000000-0000-4000-8000-000000000001'
const tenantB = '00000000-0000-4000-8000-000000000002'
const groupA = '00000000-0000-4000-8000-000000000011'
const groupB = '00000000-0000-4000-8000-000000000012'
const processId = '00000000-0000-4000-8000-000000000021'
const versionId = '00000000-0000-4000-8000-000000000031'
const processInstanceId = '00000000-0000-4000-8000-000000000041'

let database: PGlite | null = null

async function createDatabase(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema internal_security;
    create table public.hr_groups (
      tenant_id uuid not null,
      id uuid not null,
      time_zone text not null default 'Europe/Amsterdam',
      primary key (tenant_id, id)
    );
    create table public.process_instances (
      tenant_id uuid not null,
      hr_group_id uuid not null,
      id uuid not null,
      process_definition_id uuid not null,
      process_version_id uuid not null,
      primary key (tenant_id, hr_group_id, id)
    );
    create table public.process_versions (
      tenant_id uuid not null,
      hr_group_id uuid not null,
      process_definition_id uuid not null,
      id uuid not null,
      definition_json jsonb not null,
      primary key (tenant_id, hr_group_id, process_definition_id, id)
    );
    create table public.process_step_instances (
      id uuid not null,
      tenant_id uuid not null,
      hr_group_id uuid not null,
      process_instance_id uuid not null,
      process_version_id uuid not null,
      step_key text not null,
      activation_number integer not null,
      status text not null,
      activated_at timestamptz not null,
      deadline_at timestamptz,
      primary key (tenant_id, hr_group_id, id)
    );
    create table public.process_work_items (
      id uuid not null,
      tenant_id uuid not null,
      hr_group_id uuid not null,
      process_instance_id uuid not null,
      step_instance_id uuid not null,
      process_version_id uuid not null,
      step_key text not null,
      deadline_at timestamptz,
      primary key (tenant_id, hr_group_id, id)
    );
  `)
  const migration = (await readFile(migrationUrl, 'utf8')).replace(/\r\n/g, '\n')
  await db.exec(migration)
  return db
}

async function addActiveStep(db: PGlite, input: {
  tenantId?: string
  groupId?: string
  instanceId?: string
  versionId?: string
  timeZone?: string
  activatedAt: string
  amount?: number
  unit?: 'MINUTES' | 'HOURS' | 'DAYS'
  businessDays?: boolean
  noSla?: boolean
  activationNumber?: number
  stepId?: string
}) {
  const tenantId = input.tenantId ?? tenantA
  const groupId = input.groupId ?? groupA
  const instanceId = input.instanceId ?? processInstanceId
  const selectedVersionId = input.versionId ?? versionId
  const sla = input.noSla ? undefined : {
    duration: { amount: input.amount ?? 1, unit: input.unit ?? 'DAYS' },
    businessDays: input.businessDays ?? false,
    onBreach: 'NOTIFY',
  }
  await db.query(`insert into public.process_versions (tenant_id, hr_group_id, process_definition_id, id, definition_json)
    values ($1, $2, $3, $4, $5::jsonb)
    on conflict (tenant_id, hr_group_id, process_definition_id, id) do update set definition_json = excluded.definition_json`, [
    tenantId, groupId, processId, selectedVersionId, JSON.stringify({ steps: [{ key: 'review', ...(sla ? { sla } : {}) }] }),
  ])
  await db.query(`insert into public.process_instances (tenant_id, hr_group_id, id, process_definition_id, process_version_id)
    values ($1, $2, $3, $4, $5)
    on conflict (tenant_id, hr_group_id, id) do update set process_version_id = excluded.process_version_id`, [tenantId, groupId, instanceId, processId, selectedVersionId])
  await db.query(`insert into public.hr_groups (tenant_id, id, time_zone) values ($1, $2, $3) on conflict (tenant_id, id) do update set time_zone = excluded.time_zone`, [tenantId, groupId, input.timeZone ?? 'Europe/Amsterdam'])
  const stepId = input.stepId ?? '00000000-0000-4000-8000-000000000051'
  const result = await db.query<{ deadline_at: Date | null }>(`insert into public.process_step_instances
    (id, tenant_id, hr_group_id, process_instance_id, process_version_id, step_key, activation_number, status, activated_at)
    values ($1, $2, $3, $4, $5, 'review', $6, 'ACTIVE', $7::timestamptz)
    returning deadline_at`, [stepId, tenantId, groupId, instanceId, selectedVersionId, input.activationNumber ?? 1, input.activatedAt])
  return { stepId, deadlineAt: result.rows[0]?.deadline_at ?? null, tenantId, groupId, instanceId, selectedVersionId }
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null
}

describe('PMUX-06A SLA deadline materialization migration contract', () => {
  afterEach(async () => {
    await database?.close()
    database = null
  })

  it('uses elapsed hours, stores the active step deadline, and copies it unchanged to the work item', async () => {
    database = await createDatabase()
    const step = await addActiveStep(database, { activatedAt: '2026-03-28T08:00:00.000Z', amount: 24, unit: 'HOURS', timeZone: 'Europe/Amsterdam' })
    expect(iso(step.deadlineAt)).toBe('2026-03-29T08:00:00.000Z')

    const copied = await database.query<{ deadline_at: Date | null }>(`insert into public.process_work_items
      (id, tenant_id, hr_group_id, process_instance_id, step_instance_id, process_version_id, step_key, deadline_at)
      values ('00000000-0000-4000-8000-000000000061', $1, $2, $3, $4, $5, 'review', '2030-01-01T00:00:00Z') returning deadline_at`, [step.tenantId, step.groupId, step.instanceId, step.stepId, step.selectedVersionId])
    expect(iso(copied.rows[0]?.deadline_at ?? null)).toBe('2026-03-29T08:00:00.000Z')
  })

  it('uses calendar days in the HR-group timezone across DST and includes weekends', async () => {
    database = await createDatabase()
    const spring = await addActiveStep(database, { activatedAt: '2026-03-28T08:00:00.000Z', amount: 1, unit: 'DAYS', timeZone: 'Europe/Amsterdam' })
    expect(iso(spring.deadlineAt)).toBe('2026-03-29T07:00:00.000Z')

    const fall = await addActiveStep(database, { activatedAt: '2026-10-24T07:00:00.000Z', amount: 1, unit: 'DAYS', timeZone: 'Europe/Amsterdam', stepId: '00000000-0000-4000-8000-000000000052' })
    expect(iso(fall.deadlineAt)).toBe('2026-10-25T08:00:00.000Z')

    const weekend = await addActiveStep(database, { activatedAt: '2026-03-27T08:00:00.000Z', amount: 3, unit: 'DAYS', timeZone: 'Europe/Amsterdam', stepId: '00000000-0000-4000-8000-000000000053' })
    expect(iso(weekend.deadlineAt)).toBe('2026-03-30T07:00:00.000Z')
  })

  it('leaves no-SLA empty and blocks activation of a legacy workday SLA without an invented deadline', async () => {
    database = await createDatabase()
    const noSla = await addActiveStep(database, { activatedAt: '2026-10-23T08:00:00.000Z', noSla: true, stepId: '00000000-0000-4000-8000-000000000054' })
    expect(noSla.deadlineAt).toBeNull()
    await expect(addActiveStep(database, { activatedAt: '2026-10-23T08:00:00.000Z', amount: 3, unit: 'DAYS', businessDays: true, stepId: '00000000-0000-4000-8000-000000000055' })).rejects.toThrow('SLA_WORKDAY_CALENDAR_REQUIRED')
  })

  it('materializes each activation once and isolates identical process IDs across tenants', async () => {
    database = await createDatabase()
    const original = await addActiveStep(database, { activatedAt: '2026-03-28T08:00:00.000Z', amount: 1, unit: 'DAYS', timeZone: 'Europe/Amsterdam' })
    const originalDeadline = iso(original.deadlineAt)
    await database.query('update public.hr_groups set time_zone = $1 where tenant_id = $2 and id = $3', ['UTC', original.tenantId, original.groupId])
    const secondActivation = await addActiveStep(database, { activatedAt: '2026-03-30T08:00:00.000Z', amount: 1, unit: 'DAYS', timeZone: 'UTC', activationNumber: 2, stepId: '00000000-0000-4000-8000-000000000056' })
    expect(iso(secondActivation.deadlineAt)).toBe('2026-03-31T08:00:00.000Z')
    const storedOriginal = await database.query<{ deadline_at: Date | null }>('select deadline_at from public.process_step_instances where tenant_id = $1 and hr_group_id = $2 and id = $3', [original.tenantId, original.groupId, original.stepId])
    expect(iso(storedOriginal.rows[0]?.deadline_at ?? null)).toBe(originalDeadline)

    const otherTenant = await addActiveStep(database, { tenantId: tenantB, groupId: groupB, activatedAt: '2026-03-28T08:00:00.000Z', amount: 1, unit: 'DAYS', timeZone: 'UTC', stepId: '00000000-0000-4000-8000-000000000057' })
    expect(iso(otherTenant.deadlineAt)).toBe('2026-03-29T08:00:00.000Z')
    expect(iso(storedOriginal.rows[0]?.deadline_at ?? null)).toBe('2026-03-29T07:00:00.000Z')
  })
})
