import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'

const migrationUrl = new URL('./20261023131000_pmux07a_process_insights.sql', import.meta.url)
const tenantA = '00000000-0000-4000-8000-000000000001'
const tenantB = '00000000-0000-4000-8000-000000000002'
const groupA = '00000000-0000-4000-8000-000000000011'
const groupB = '00000000-0000-4000-8000-000000000012'
const groupC = '00000000-0000-4000-8000-000000000013'
const userA = '00000000-0000-4000-8000-000000000071'
const definitionA = '00000000-0000-4000-8000-000000000101'
const versionOne = '00000000-0000-4000-8000-000000000201'
const versionTwo = '00000000-0000-4000-8000-000000000202'
const definitionB = '00000000-0000-4000-8000-000000000111'
const versionB = '00000000-0000-4000-8000-000000000211'
const definitionC = '00000000-0000-4000-8000-000000000121'
const versionC = '00000000-0000-4000-8000-000000000221'

interface Projection {
  summary: {
    started: number
    completed: number
    runningNow: number
    rejected: number
    cancelled: number
    averageLeadSeconds: number | null
    medianLeadSeconds: number | null
    slaDenominator: number
    slaWithin: number
    slaOutside: number
  }
  processTotal: number
  processes: Array<Record<string, unknown>>
  stepTotal: number
  steps: Array<Record<string, unknown>>
  processOptions: Array<Record<string, unknown>>
}

let database: PGlite | null = null

async function createDatabase(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(String.raw`
    create role anon;
    create role authenticated;
    create schema auth;
    create schema internal_security;
    create type public.access_scope_type as enum ('TENANT', 'ADMINISTRATION');
    create type public.process_instance_status as enum ('DRAFT', 'RUNNING', 'WAITING', 'BLOCKED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED');
    create type public.process_step_instance_status as enum ('PENDING', 'ACTIVE', 'BLOCKED', 'COMPLETED', 'REJECTED', 'CANCELLED');
    create type public.process_work_item_status as enum ('OPEN', 'CLAIMED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'BLOCKED');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function internal_security.process_scope_has_permission(uuid, uuid, public.access_scope_type, uuid, text)
    returns boolean language sql stable as $$
      select coalesce(auth.uid() = '00000000-0000-4000-8000-000000000071'::uuid and $1 = '00000000-0000-4000-8000-000000000001'::uuid and $2 = '00000000-0000-4000-8000-000000000011'::uuid
        and $5 = 'process-operations:read', false)
    $$;
    create function internal_security.process_definition_content(jsonb) returns jsonb language sql immutable as $$
      select coalesce($1 -> 'content', $1)
    $$;
    create function internal_security.process_localized_text(jsonb, text, text) returns text language sql immutable as $$
      select coalesce($1 ->> case when $2 = 'en' then 'en' else 'nl' end, $1 ->> 'nl', $1 ->> 'en', $3)
    $$;
    create table public.hr_groups (
      tenant_id uuid not null,
      id uuid primary key,
      time_zone text not null
    );
    create table public.process_definitions (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      scope_type public.access_scope_type not null default 'TENANT', administration_id uuid,
      key text not null, title jsonb not null
    );
    create table public.process_versions (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      process_definition_id uuid not null, version_number integer not null, definition_json jsonb not null
    );
    create table public.process_instances (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      scope_type public.access_scope_type not null, administration_id uuid,
      process_definition_id uuid not null, process_version_id uuid not null,
      status public.process_instance_status not null, started_at timestamptz, completed_at timestamptz
    );
    create table public.process_events (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      process_instance_id uuid not null, work_item_id uuid, event_type text not null,
      payload jsonb not null, created_at timestamptz not null
    );
    create table public.process_step_instances (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      process_instance_id uuid not null, process_version_id uuid not null,
      step_key text not null, status public.process_step_instance_status not null,
      activated_at timestamptz, deadline_at timestamptz, completed_at timestamptz
    );
    create table public.process_work_items (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      process_instance_id uuid not null, process_version_id uuid not null,
      step_instance_id uuid not null, step_key text not null,
      status public.process_work_item_status not null, updated_at timestamptz not null
    );
    insert into public.hr_groups values
      ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Europe/Amsterdam'),
      ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', 'Europe/Amsterdam'),
      ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000013', 'Europe/Amsterdam');
    insert into public.process_definitions (id, tenant_id, hr_group_id, key, title) values
      ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'onboarding', '{"nl":"Onboarding","en":"Onboarding"}'),
      ('00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', 'foreign-group-process', '{"nl":"Buiten groep","en":"Outside group"}'),
      ('00000000-0000-4000-8000-000000000121', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000013', 'foreign-tenant-process', '{"nl":"Buiten tenant","en":"Outside tenant"}');
    insert into public.process_versions values
      ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000101', 1, '{"title":{"nl":"Onboarding historisch","en":"Legacy onboarding"},"steps":[{"key":"review","title":{"nl":"Beoordelen","en":"Review"}}]}'),
      ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000101', 2, '{"title":{"nl":"Onboarding actueel","en":"Current onboarding"},"steps":[{"key":"review","title":{"nl":"Managerbeoordeling","en":"Manager review"}}]}'),
      ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000111', 1, '{"steps":[]}'),
      ('00000000-0000-4000-8000-000000000221', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000121', 1, '{"steps":[]}');
  `)
  await db.exec(await readFile(migrationUrl, 'utf8'))
  return db
}

async function insertInstance(db: PGlite, input: {
  id: string
  status: string
  versionId?: string
  startedAt: string
  completedAt?: string | null
  terminalOutcome?: 'COMPLETED' | 'REJECTED' | 'CANCELLED'
  tenantId?: string
  groupId?: string
  definitionId?: string
}): Promise<void> {
  const tenantId = input.tenantId ?? tenantA
  const groupId = input.groupId ?? groupA
  const definitionId = input.definitionId ?? definitionA
  const versionId = input.versionId ?? versionOne
  await db.query(
    'insert into public.process_instances (id, tenant_id, hr_group_id, scope_type, process_definition_id, process_version_id, status, started_at, completed_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [input.id, tenantId, groupId, 'TENANT', definitionId, versionId, input.status, input.startedAt, input.completedAt ?? null],
  )
  await db.query(
    'insert into public.process_events (id, tenant_id, hr_group_id, process_instance_id, event_type, payload, created_at) values ($1, $2, $3, $4, $5, $6::jsonb, $7)',
    [randomUUID(), tenantId, groupId, input.id, 'PROCESS_STARTED', '{}', input.startedAt],
  )
  if (input.terminalOutcome && input.completedAt) {
    await db.query(
      'insert into public.process_events (id, tenant_id, hr_group_id, process_instance_id, event_type, payload, created_at) values ($1, $2, $3, $4, $5, $6::jsonb, $7)',
      [randomUUID(), tenantId, groupId, input.id, 'PROCESS_TERMINAL', JSON.stringify({ outcome: input.terminalOutcome }), input.completedAt],
    )
  }
}

async function insertCompletedStep(db: PGlite, input: {
  instanceId: string
  stepId: string
  workItemId: string
  versionId: string
  activatedAt: string
  claimedAt: string
  deadlineAt: string
  completedAt: string
}): Promise<void> {
  await db.query(
    'insert into public.process_step_instances (id, tenant_id, hr_group_id, process_instance_id, process_version_id, step_key, status, activated_at, deadline_at, completed_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [input.stepId, tenantA, groupA, input.instanceId, input.versionId, 'review', 'COMPLETED', input.activatedAt, input.deadlineAt, input.completedAt],
  )
  await db.query(
    'insert into public.process_work_items (id, tenant_id, hr_group_id, process_instance_id, process_version_id, step_instance_id, step_key, status, updated_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [input.workItemId, tenantA, groupA, input.instanceId, input.versionId, input.stepId, 'review', 'COMPLETED', input.completedAt],
  )
  await db.query(
    'insert into public.process_events (id, tenant_id, hr_group_id, process_instance_id, work_item_id, event_type, payload, created_at) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)',
    [randomUUID(), tenantA, groupA, input.instanceId, input.workItemId, 'WORK_ITEM_CLAIMED', '{}', input.claimedAt],
  )
}

async function getProjection(db: PGlite, input: {
  from?: string
  to?: string
  processId?: string | null
  page?: number
  pageSize?: number
  groupId?: string
} = {}): Promise<Projection> {
  await db.exec('set role authenticated')
  try {
    const { rows } = await db.query<{ result: Projection }>(
      'select public.get_process_insights_projection($1, $2, $3, $4, $5, $6, $7) as result',
      [input.groupId ?? groupA, input.from ?? '2026-10-01', input.to ?? '2026-10-31', input.processId ?? null, input.page ?? 1, input.pageSize ?? 20, 'nl'],
    )
    return rows[0]!.result
  } finally {
    await db.exec('reset role')
  }
}

afterEach(async () => {
  if (database) await database.close()
  database = null
})

describe('PMUX-07A process insights projection', () => {
  it('grants scoped reads through the public wrapper while keeping the helper private', async () => {
    database = await createDatabase()
    const db = database
    const access = await db.query<{ publicExecute: boolean; helperExecute: boolean; anonExecute: boolean }>(`select
      has_function_privilege('authenticated', 'public.get_process_insights_projection(uuid, date, date, uuid, integer, integer, text)', 'EXECUTE') as "publicExecute",
      has_function_privilege('authenticated', 'internal_security.get_process_insights_projection(uuid, date, date, uuid, integer, integer, text)', 'EXECUTE') as "helperExecute",
      has_function_privilege('anon', 'public.get_process_insights_projection(uuid, date, date, uuid, integer, integer, text)', 'EXECUTE') as "anonExecute"`)
    expect(access.rows[0]).toEqual({ publicExecute: true, helperExecute: false, anonExecute: false })
    await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', userA])
    await db.exec('set role authenticated')
    await expect(db.query(
      'select internal_security.get_process_insights_projection($1, $2, $3, $4, $5, $6, $7)',
      [groupA, '2026-10-01', '2026-10-31', null, 1, 20, 'nl'],
    )).rejects.toThrow()
    await db.exec('reset role')
    await expect(getProjection(db)).resolves.toMatchObject({ summary: { started: 0 } })
  })

  it('uses local HR-group event dates, successful calendar lead times, first-claim waits, and completed-step SLA denominator', async () => {
    database = await createDatabase()
    const db = database
    const completedOne = '00000000-0000-4000-8000-000000000301'
    const completedTwo = '00000000-0000-4000-8000-000000000302'
    const rejected = '00000000-0000-4000-8000-000000000303'
    const cancelled = '00000000-0000-4000-8000-000000000304'
    const running = '00000000-0000-4000-8000-000000000305'
    const foreignGroup = '00000000-0000-4000-8000-000000000306'
    const foreignTenant = '00000000-0000-4000-8000-000000000309'
    const outsideLocalRange = '00000000-0000-4000-8000-000000000307'
    const endBoundary = '00000000-0000-4000-8000-000000000308'
    await insertInstance(db, { id: completedOne, status: 'COMPLETED', versionId: versionOne, startedAt: '2026-09-30T22:00:00Z', completedAt: '2026-10-03T06:00:00Z', terminalOutcome: 'COMPLETED' })
    await insertInstance(db, { id: completedTwo, status: 'COMPLETED', versionId: versionTwo, startedAt: '2026-10-02T06:00:00Z', completedAt: '2026-10-03T06:00:00Z', terminalOutcome: 'COMPLETED' })
    await insertInstance(db, { id: rejected, status: 'REJECTED', startedAt: '2026-10-03T06:00:00Z', completedAt: '2026-10-04T06:00:00Z', terminalOutcome: 'REJECTED' })
    await insertInstance(db, { id: cancelled, status: 'CANCELLED', startedAt: '2026-10-04T06:00:00Z', completedAt: '2026-10-05T06:00:00Z', terminalOutcome: 'CANCELLED' })
    await insertInstance(db, { id: running, status: 'RUNNING', versionId: versionTwo, startedAt: '2026-10-05T06:00:00Z' })
    await insertInstance(db, { id: foreignGroup, status: 'COMPLETED', startedAt: '2026-10-06T06:00:00Z', completedAt: '2026-10-07T06:00:00Z', terminalOutcome: 'COMPLETED', groupId: groupB, definitionId: definitionB, versionId: versionB })
    await insertInstance(db, { id: foreignTenant, status: 'COMPLETED', startedAt: '2026-10-06T06:00:00Z', completedAt: '2026-10-07T06:00:00Z', terminalOutcome: 'COMPLETED', tenantId: tenantB, groupId: groupC, definitionId: definitionC, versionId: versionC })
    await insertInstance(db, { id: outsideLocalRange, status: 'COMPLETED', startedAt: '2026-10-31T23:00:00Z', completedAt: '2026-11-01T01:00:00Z', terminalOutcome: 'COMPLETED' })
    await insertInstance(db, { id: endBoundary, status: 'COMPLETED', startedAt: '2026-10-30T06:00:00Z', completedAt: '2026-10-31T23:00:00Z', terminalOutcome: 'COMPLETED' })
    await insertCompletedStep(db, {
      instanceId: completedOne,
      stepId: '00000000-0000-4000-8000-000000000401',
      workItemId: '00000000-0000-4000-8000-000000000501',
      versionId: versionOne,
      activatedAt: '2026-09-30T22:00:00Z',
      claimedAt: '2026-10-01T18:00:00Z',
      deadlineAt: '2026-10-02T06:00:00Z',
      completedAt: '2026-10-03T06:00:00Z',
    })
    await insertCompletedStep(db, {
      instanceId: completedTwo,
      stepId: '00000000-0000-4000-8000-000000000402',
      workItemId: '00000000-0000-4000-8000-000000000502',
      versionId: versionTwo,
      activatedAt: '2026-10-02T06:00:00Z',
      claimedAt: '2026-10-02T12:00:00Z',
      deadlineAt: '2026-10-03T06:00:00Z',
      completedAt: '2026-10-03T06:00:00Z',
    })
    await insertCompletedStep(db, {
      instanceId: completedOne,
      stepId: '00000000-0000-4000-8000-000000000404',
      workItemId: '00000000-0000-4000-8000-000000000504',
      versionId: versionOne,
      activatedAt: '2026-10-01T06:00:00Z',
      claimedAt: '2026-10-02T06:00:00Z',
      deadlineAt: '2026-10-02T06:00:00Z',
      completedAt: '2026-10-03T06:00:00Z',
    })
    await db.query(
      'insert into public.process_step_instances (id, tenant_id, hr_group_id, process_instance_id, process_version_id, step_key, status, activated_at) values ($1, $2, $3, $4, $5, $6, $7, $8)',
      ['00000000-0000-4000-8000-000000000403', tenantA, groupA, running, versionTwo, 'review', 'ACTIVE', '2026-10-05T06:00:00Z'],
    )
    await db.query(
      'insert into public.process_work_items (id, tenant_id, hr_group_id, process_instance_id, process_version_id, step_instance_id, step_key, status, updated_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      ['00000000-0000-4000-8000-000000000503', tenantA, groupA, running, versionTwo, '00000000-0000-4000-8000-000000000403', 'review', 'OPEN', '2026-10-05T06:00:00Z'],
    )
    await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', userA])

    const result = await getProjection(db)
    expect(result.summary).toEqual({
      started: 6,
      completed: 2,
      runningNow: 1,
      rejected: 1,
      cancelled: 1,
      averageLeadSeconds: 144000,
      medianLeadSeconds: 144000,
      slaDenominator: 3,
      slaWithin: 1,
      slaOutside: 2,
    })
    expect(result.processTotal).toBe(2)
    expect(result.processes.map((item) => item.versionNumber)).toEqual([2, 1])
    expect(result.processes.map((item) => item.processTitle)).toEqual(['Onboarding actueel', 'Onboarding historisch'])
    expect(result.steps.map((item) => item.stepTitle)).toEqual(['Beoordelen', 'Managerbeoordeling'])
    expect(result.steps.map((item) => item.averageWaitSeconds)).toEqual([79200, 21600])
    expect(result.steps[1]?.awaitingFirstClaimCount).toBe(1)
    expect(result.steps[0]?.slaOutside).toBe(2)
    expect(result.steps.reduce((total, item) => total + Number(item.slaDenominator), 0)).toBe(3)
    expect(result.processOptions).toHaveLength(1)
    expect(JSON.stringify(result)).not.toMatch(/employee|participant|form|payload/i)
  })

  it('preserves exact totals across process filters and pages', async () => {
    database = await createDatabase()
    const db = database
    await insertInstance(db, { id: '00000000-0000-4000-8000-000000000311', status: 'COMPLETED', versionId: versionOne, startedAt: '2026-10-01T06:00:00Z', completedAt: '2026-10-01T08:00:00Z', terminalOutcome: 'COMPLETED' })
    await insertInstance(db, { id: '00000000-0000-4000-8000-000000000312', status: 'COMPLETED', versionId: versionTwo, startedAt: '2026-10-02T06:00:00Z', completedAt: '2026-10-02T08:00:00Z', terminalOutcome: 'COMPLETED' })
    await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', userA])

    const first = await getProjection(db, { processId: definitionA, page: 1, pageSize: 1 })
    const second = await getProjection(db, { processId: definitionA, page: 2, pageSize: 1 })
    expect(first.processTotal).toBe(2)
    expect(second.processTotal).toBe(2)
    expect(first.processes).toHaveLength(1)
    expect(second.processes).toHaveLength(1)
    expect(first.processes[0]?.versionNumber).toBe(2)
    expect(second.processes[0]?.versionNumber).toBe(1)
    expect((await getProjection(db, { processId: '00000000-0000-4000-8000-000000000199' })).summary.started).toBe(0)
  })

  it('returns explicit zero and null metrics for an empty period and denies missing identity or unauthorized HR-group scope', async () => {
    database = await createDatabase()
    const db = database
    await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', userA])
    const empty = await getProjection(db, { from: '2026-01-01', to: '2026-01-31' })
    expect(empty.summary.started).toBe(0)
    expect(empty.summary.averageLeadSeconds).toBeNull()
    expect(empty.summary.slaDenominator).toBe(0)
    expect(empty.processes).toEqual([])
    expect(empty.steps).toEqual([])

    await expect(getProjection(db, { groupId: groupB })).resolves.toMatchObject({ summary: { started: 0 }, processTotal: 0 })
    await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', ''])
    await expect(db.query(
      'select public.get_process_insights_projection($1, $2, $3, $4, $5, $6, $7)',
      [groupA, '2026-10-01', '2026-10-31', null, 1, 20, 'nl'],
    )).rejects.toThrow('AUTHENTICATION_REQUIRED')
  })

  it('rejects an unbounded report period and invalid page sizes', async () => {
    database = await createDatabase()
    const db = database
    await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', userA])
    await expect(getProjection(db, { from: '2025-01-01', to: '2026-10-31' })).rejects.toThrow('PROCESS_INSIGHTS_FILTER_INVALID')
    await expect(db.query(
      'select public.get_process_insights_projection($1, $2, $3, $4, $5, $6, $7)',
      [groupA, '2026-10-01', '2026-10-31', null, 1, 51, 'nl'],
    )).rejects.toThrow('PROCESS_INSIGHTS_FILTER_INVALID')
  })
})
