import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'

const migrationUrl = new URL('./20261023112158_pmux06c_process_operations_workspace.sql', import.meta.url)
const tenantA = '00000000-0000-4000-8000-000000000001'
const tenantB = '00000000-0000-4000-8000-000000000002'
const groupA = '00000000-0000-4000-8000-000000000011'
const groupB = '00000000-0000-4000-8000-000000000012'
const groupC = '00000000-0000-4000-8000-000000000013'
const userA = '00000000-0000-4000-8000-000000000071'
const userB = '00000000-0000-4000-8000-000000000072'
const employeeA = '00000000-0000-4000-8000-000000000061'

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
    create type public.workflow_job_type as enum ('PROCESS_REMINDER', 'PROCESS_DOCUMENT_OUTPUT');
    create type public.workflow_job_status as enum ('READY', 'RUNNING', 'RETRY', 'SUCCEEDED', 'DEAD_LETTER');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function internal_security.process_scope_has_permission(uuid, uuid, public.access_scope_type, uuid, text)
    returns boolean language sql stable as $$
      select coalesce(auth.uid() = '${userA}'::uuid and $1 = '${tenantA}'::uuid and $2 = '${groupA}'::uuid
        and ($5 = 'process-operations:read' or ($5 = 'process-operations:write' and current_setting('test.process_operations_write', true) = 'true')), false)
    $$;
    create function internal_security.process_definition_content(jsonb) returns jsonb language sql immutable as $$
      select coalesce($1 -> 'content', $1)
    $$;
    create function internal_security.process_localized_text(jsonb, text, text) returns text language sql immutable as $$
      select coalesce($1 ->> case when $2 = 'en' then 'en' else 'nl' end, $1 ->> 'nl', $1 ->> 'en', $3)
    $$;
    create table public.process_definitions (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      key text not null, title jsonb not null
    );
    create table public.process_versions (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      process_definition_id uuid not null, definition_json jsonb not null
    );
    create table public.process_instances (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      scope_type public.access_scope_type not null, administration_id uuid,
      process_definition_id uuid not null, process_version_id uuid not null,
      status public.process_instance_status not null, current_step_key text,
      started_at timestamptz, updated_at timestamptz not null default now()
    );
    create table public.process_step_instances (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      process_instance_id uuid not null, step_key text not null,
      status public.process_step_instance_status not null, updated_at timestamptz not null default now()
    );
    create table public.process_outputs (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      process_instance_id uuid not null, output_key text not null, status text not null,
      document_id uuid, last_error_code text, generated_at timestamptz,
      created_at timestamptz not null default now()
    );
    create table public.employees (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      auth_user_id uuid, first_name text not null, birth_name text not null, deleted_at timestamptz
    );
    create table public.process_work_items (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      process_instance_id uuid not null, step_instance_id uuid, step_key text not null,
      status public.process_work_item_status not null, assignee_employee_id uuid,
      claimed_by_user_id uuid, deadline_at timestamptz,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table public.workflow_jobs (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      administration_id uuid, process_instance_id uuid not null, step_instance_id uuid,
      work_item_id uuid, job_type public.workflow_job_type not null,
      status public.workflow_job_status not null, available_at timestamptz not null,
      attempts integer not null, max_attempts integer not null, last_attempt_at timestamptz,
      last_error_code text, last_error_at timestamptz, locked_at timestamptz, locked_by uuid,
      updated_at timestamptz not null default now(),
      created_at timestamptz not null default now(), correlation_id uuid, payload jsonb not null default '{}'::jsonb
    );
  `)
  await db.exec(await readFile(migrationUrl, 'utf8'))
  const existingRecoverySql = await readFile(new URL('./20260808171520_process_automation_p7_output_document.sql', import.meta.url), 'utf8')
  const internalRequeue = existingRecoverySql.match(/create or replace function internal_security\.requeue_workflow_job\(requested_job_id uuid\)[\s\S]*?\n\$\$;/i)
  const publicRequeue = existingRecoverySql.match(/create or replace function public\.requeue_workflow_job\(requested_job_id uuid\)[\s\S]*?\n\$\$;/i)
  if (!internalRequeue || !publicRequeue) throw new Error('Existing workflow job recovery contract was not found')
  await db.exec(`${internalRequeue[0]}\n${publicRequeue[0]}`)
  return db
}

async function insertInstance(db: PGlite, input: {
  id: string
  tenantId?: string
  groupId?: string
  status: string
  stepKey?: string
}): Promise<void> {
  const tenantId = input.tenantId ?? tenantA
  const groupId = input.groupId ?? groupA
  const definitionId = `00000000-0000-4000-8000-0000000001${input.id.slice(-2)}`
  const versionId = `00000000-0000-4000-8000-0000000002${input.id.slice(-2)}`
  await db.query('insert into public.process_definitions (id, tenant_id, hr_group_id, key, title) values ($1, $2, $3, $4, $5::jsonb)', [definitionId, tenantId, groupId, 'onboarding', JSON.stringify({ nl: 'Onboarding', en: 'Onboarding' })])
  await db.query('insert into public.process_versions (id, tenant_id, hr_group_id, process_definition_id, definition_json) values ($1, $2, $3, $4, $5::jsonb)', [versionId, tenantId, groupId, definitionId, JSON.stringify({ steps: [{ key: 'review', title: { nl: 'Beoordelen', en: 'Review' } }] })])
  await db.query('insert into public.process_instances (id, tenant_id, hr_group_id, scope_type, process_definition_id, process_version_id, status, current_step_key, started_at) values ($1, $2, $3, $4, $5, $6, $7, $8, now() - interval \'2 days\')', [input.id, tenantId, groupId, 'TENANT', definitionId, versionId, input.status, input.stepKey ?? 'review'])
}

afterEach(async () => {
  if (database) await database.close()
  database = null
})

describe('PMUX-06C process operations projection', () => {
  it('returns only scoped operational problems, exact totals, safe retry state, and no job payload', async () => {
    database = await createDatabase()
    const db = database
    const blockedInstance = '00000000-0000-4000-8000-000000000021'
    const overdueInstance = '00000000-0000-4000-8000-000000000022'
    const retryInstance = '00000000-0000-4000-8000-000000000023'
    const failedInstance = '00000000-0000-4000-8000-000000000024'
    const closedInstance = '00000000-0000-4000-8000-000000000025'
    const outputInstance = '00000000-0000-4000-8000-000000000026'
    const foreignInstance = '00000000-0000-4000-8000-000000000027'
    const foreignGroupInstance = '00000000-0000-4000-8000-000000000028'
    await insertInstance(db, { id: blockedInstance, status: 'BLOCKED' })
    await insertInstance(db, { id: overdueInstance, status: 'RUNNING' })
    await insertInstance(db, { id: retryInstance, status: 'RUNNING' })
    await insertInstance(db, { id: failedInstance, status: 'RUNNING' })
    await insertInstance(db, { id: closedInstance, status: 'CANCELLED' })
    await insertInstance(db, { id: outputInstance, status: 'COMPLETED' })
    await insertInstance(db, { id: foreignInstance, tenantId: tenantB, groupId: groupB, status: 'RUNNING' })
    await insertInstance(db, { id: foreignGroupInstance, groupId: groupC, status: 'BLOCKED' })
    await db.query('insert into public.employees (id, tenant_id, hr_group_id, auth_user_id, first_name, birth_name) values ($1, $2, $3, $4, $5, $6)', [employeeA, tenantA, groupA, userA, 'Jan', 'Beheerder'])
    await db.query('insert into public.process_step_instances (id, tenant_id, hr_group_id, process_instance_id, step_key, status) values ($1, $2, $3, $4, $5, $6)', ['00000000-0000-4000-8000-000000000041', tenantA, groupA, blockedInstance, 'review', 'BLOCKED'])
    const retryStep = '00000000-0000-4000-8000-000000000042'
    await db.query('insert into public.process_step_instances (id, tenant_id, hr_group_id, process_instance_id, step_key, status) values ($1, $2, $3, $4, $5, $6)', [retryStep, tenantA, groupA, retryInstance, 'review', 'ACTIVE'])
    await db.query('insert into public.process_work_items (id, tenant_id, hr_group_id, process_instance_id, step_instance_id, step_key, status, assignee_employee_id, deadline_at) values ($1, $2, $3, $4, $5, $6, $7, $8, now() - interval \'1 hour\')', ['00000000-0000-4000-8000-000000000051', tenantA, groupA, blockedInstance, '00000000-0000-4000-8000-000000000041', 'review', 'BLOCKED', employeeA])
    const overdueItem = '00000000-0000-4000-8000-000000000052'
    const retryItem = '00000000-0000-4000-8000-000000000053'
    await db.query('insert into public.process_work_items (id, tenant_id, hr_group_id, process_instance_id, step_key, status, assignee_employee_id, deadline_at) values ($1, $2, $3, $4, $5, $6, $7, now() - interval \'1 hour\')', [overdueItem, tenantA, groupA, overdueInstance, 'review', 'OPEN', employeeA])
    await db.query('insert into public.process_work_items (id, tenant_id, hr_group_id, process_instance_id, step_instance_id, step_key, status, assignee_employee_id) values ($1, $2, $3, $4, $5, $6, $7, $8)', [retryItem, tenantA, groupA, retryInstance, retryStep, 'review', 'OPEN', employeeA])
    await db.query(`insert into public.workflow_jobs (id, tenant_id, hr_group_id, process_instance_id, step_instance_id, work_item_id, job_type, status, available_at, attempts, max_attempts, last_attempt_at, last_error_code, last_error_at, payload) values
      ('00000000-0000-4000-8000-000000000061', $1, $2, $3, $4, $5, 'PROCESS_REMINDER', 'RETRY', now() + interval '20 minutes', 2, 5, now() - interval '2 minutes', 'PROCESS_REMINDER_TEMPORARY', now() - interval '2 minutes', '{"privateAnswer":"should-not-be-returned"}'),
      ('00000000-0000-4000-8000-000000000062', $1, $2, $6, null, null, 'PROCESS_REMINDER', 'DEAD_LETTER', now(), 5, 5, now() - interval '3 minutes', 'PROCESS_REMINDER_FAILED', now() - interval '3 minutes', '{}'),
      ('00000000-0000-4000-8000-000000000063', $1, $2, $7, null, null, 'PROCESS_REMINDER', 'DEAD_LETTER', now(), 5, 5, now() - interval '4 minutes', 'PROCESS_REMINDER_CANCELLED', now() - interval '4 minutes', '{}'),
      ('00000000-0000-4000-8000-000000000064', $1, $2, $8, null, null, 'PROCESS_DOCUMENT_OUTPUT', 'DEAD_LETTER', now(), 5, 5, now() - interval '5 minutes', 'PROCESS_OUTPUT_FAILED', now() - interval '5 minutes', '{}'),
      ('00000000-0000-4000-8000-000000000065', $9, $10, $11, null, null, 'PROCESS_REMINDER', 'DEAD_LETTER', now(), 5, 5, now(), 'FOREIGN_FAILURE', now(), '{}')`, [tenantA, groupA, retryInstance, retryStep, retryItem, failedInstance, closedInstance, outputInstance, tenantB, groupB, foreignInstance])
    await db.query("insert into public.workflow_jobs (id, tenant_id, hr_group_id, process_instance_id, job_type, status, available_at, attempts, max_attempts) values ('00000000-0000-4000-8000-000000000066', $1, $2, $3, 'PROCESS_REMINDER', 'DEAD_LETTER', now(), 5, 5)", [tenantA, groupC, foreignGroupInstance])
    await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', userA])
    await db.query('select set_config($1, $2, false)', ['test.process_operations_write', 'true'])

    const { rows } = await db.query<{ result: { summary: Record<string, number>; total: number; items: Array<Record<string, unknown>> } }>(
      "select public.get_process_operations_inbox(null, 'ALL', 1, 25, 'nl') as result",
    )
    const result = rows[0].result
    expect(result.summary).toEqual({ blockedProcesses: 1, overdueTasks: 1, failedAutomations: 3, retryingAutomations: 1 })
    expect(result.total).toBe(6)
    expect(result.items.map((item) => item.problemKey)).toEqual(expect.arrayContaining(['BLOCKED_PROCESS', 'OVERDUE_WORK_ITEM', 'AUTOMATION_RETRY', 'AUTOMATION_FAILED']))
    expect(result.items.find((item) => item.workItemId === overdueItem)?.responsibleLabel).toBe('Jan Beheerder')
    expect(JSON.stringify(result)).not.toContain('should-not-be-returned')
    const closedReminder = result.items.find((item) => item.jobId === '00000000-0000-4000-8000-000000000063')
    expect(closedReminder?.canRecover).toBe(false)
    const activeReminder = result.items.find((item) => item.jobId === '00000000-0000-4000-8000-000000000061')
    expect(activeReminder?.canRecover).toBe(true)
    const completedOutput = result.items.find((item) => item.jobId === '00000000-0000-4000-8000-000000000064')
    expect(completedOutput?.canRecover).toBe(true)
    await expect(db.query("select public.requeue_workflow_job('00000000-0000-4000-8000-000000000065')"))
      .rejects.toThrow('FORBIDDEN')
    await expect(db.query("select public.requeue_workflow_job('00000000-0000-4000-8000-000000000066')"))
      .rejects.toThrow('FORBIDDEN')
  })

  it('does not offer recovery to a read-only operator in either inbox or process detail', async () => {
    database = await createDatabase()
    const db = database
    const instanceId = '00000000-0000-4000-8000-000000000021'
    const stepId = '00000000-0000-4000-8000-000000000041'
    const itemId = '00000000-0000-4000-8000-000000000051'
    await insertInstance(db, { id: instanceId, status: 'RUNNING' })
    await db.query('insert into public.process_step_instances (id, tenant_id, hr_group_id, process_instance_id, step_key, status) values ($1, $2, $3, $4, $5, $6)', [stepId, tenantA, groupA, instanceId, 'review', 'ACTIVE'])
    await db.query('insert into public.process_work_items (id, tenant_id, hr_group_id, process_instance_id, step_instance_id, step_key, status) values ($1, $2, $3, $4, $5, $6, $7)', [itemId, tenantA, groupA, instanceId, stepId, 'review', 'OPEN'])
    await db.query("insert into public.workflow_jobs (id, tenant_id, hr_group_id, process_instance_id, step_instance_id, work_item_id, job_type, status, available_at, attempts, max_attempts) values ('00000000-0000-4000-8000-000000000061', $1, $2, $3, $4, $5, 'PROCESS_REMINDER', 'RETRY', now() + interval '10 minutes', 1, 5)", [tenantA, groupA, instanceId, stepId, itemId])
    await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', userA])
    const { rows } = await db.query<{ result: { items: Array<{ canRecover: boolean }> } }>(
      "select public.get_process_operations_inbox(null, 'ALL', 1, 25, 'nl') as result",
    )
    expect(rows[0].result.items[0]?.canRecover).toBe(false)
    await expect(db.query('select public.requeue_workflow_job($1)', ['00000000-0000-4000-8000-000000000061']))
      .rejects.toThrow('FORBIDDEN')
    const detail = await db.query<{ result: { jobs: Array<{ canRecover: boolean }> } }>(
      'select internal_security.get_process_automation_operations($1) as result', [instanceId],
    )
    expect(detail.rows[0].result.jobs[0]?.canRecover).toBe(false)
  })

  it('reports an empty authorized scope without presenting synthetic issues', async () => {
    database = await createDatabase()
    const db = database
    await insertInstance(db, { id: '00000000-0000-4000-8000-000000000021', status: 'RUNNING' })
    await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', userA])

    const { rows } = await db.query<{ result: { summary: Record<string, number>; total: number; totalPages: number; items: unknown[] } }>(
      "select public.get_process_operations_inbox(null, 'ALL', 1, 25, 'nl') as result",
    )
    expect(rows[0].result).toEqual({
      summary: { blockedProcesses: 0, overdueTasks: 0, failedAutomations: 0, retryingAutomations: 0 },
      page: 1,
      pageSize: 25,
      total: 0,
      totalPages: 0,
      items: [],
    })
  })

  it('reuses the existing queue row and rejects a repeated manual requeue', async () => {
    database = await createDatabase()
    const db = database
    const instanceId = '00000000-0000-4000-8000-000000000021'
    const jobId = '00000000-0000-4000-8000-000000000061'
    await insertInstance(db, { id: instanceId, status: 'RUNNING' })
    await db.query("insert into public.workflow_jobs (id, tenant_id, hr_group_id, process_instance_id, job_type, status, available_at, attempts, max_attempts, last_error_code, last_error_at) values ($1, $2, $3, $4, 'PROCESS_REMINDER', 'RETRY', now() + interval '10 minutes', 2, 5, 'PROCESS_REMINDER_TEMPORARY', now())", [jobId, tenantA, groupA, instanceId])
    await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', userA])
    await db.query('select set_config($1, $2, false)', ['test.process_operations_write', 'true'])

    const first = await db.query<{ result: { id: string; status: string } }>('select public.requeue_workflow_job($1) as result', [jobId])
    expect(first.rows[0].result).toEqual({ id: jobId, status: 'READY' })
    await expect(db.query('select public.requeue_workflow_job($1)', [jobId]))
      .rejects.toThrow('WORKFLOW_JOB_NOT_RECOVERABLE')
    const jobs = await db.query<{ count: string; status: string; attempts: number }>(
      'select count(*)::text as count, max(status::text) as status, max(attempts) as attempts from public.workflow_jobs where id = $1', [jobId],
    )
    expect(jobs.rows[0]).toEqual({ count: '1', status: 'READY', attempts: 0 })
  })

  it('applies filters and search before pagination while keeping scope totals independent of the current page', async () => {
    database = await createDatabase()
    const db = database
    await insertInstance(db, { id: '00000000-0000-4000-8000-000000000021', status: 'RUNNING' })
    await insertInstance(db, { id: '00000000-0000-4000-8000-000000000022', status: 'RUNNING' })
    await db.query(`insert into public.workflow_jobs (id, tenant_id, hr_group_id, process_instance_id, job_type, status, available_at, attempts, max_attempts, last_error_code) values
      ('00000000-0000-4000-8000-000000000061', $1, $2, '00000000-0000-4000-8000-000000000021', 'PROCESS_REMINDER', 'RETRY', now() + interval '1 hour', 1, 5, 'TEMPORARY'),
      ('00000000-0000-4000-8000-000000000062', $1, $2, '00000000-0000-4000-8000-000000000022', 'PROCESS_REMINDER', 'DEAD_LETTER', now(), 5, 5, 'FAILED')`, [tenantA, groupA])
    await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', userA])

    const { rows } = await db.query<{ result: { summary: Record<string, number>; total: number; page: number; items: Array<Record<string, unknown>> } }>(
      "select public.get_process_operations_inbox('Onboarding', 'RETRY', 1, 1, 'en') as result",
    )
    expect(rows[0].result.summary).toMatchObject({ retryingAutomations: 1, failedAutomations: 1 })
    expect(rows[0].result).toMatchObject({ total: 1, page: 1 })
    expect(rows[0].result.items).toHaveLength(1)
    expect(rows[0].result.items[0]).toMatchObject({ problemKey: 'AUTOMATION_RETRY', processTitle: 'Onboarding' })
  })

  it('fails closed without an operator identity and does not leak another tenant scope', async () => {
    database = await createDatabase()
    const db = database
    await insertInstance(db, { id: '00000000-0000-4000-8000-000000000021', tenantId: tenantB, groupId: groupB, status: 'RUNNING' })
    await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', userB])

    const denied = await db.query("select public.get_process_operations_inbox(null, 'ALL', 1, 25, 'nl')")
    expect(denied.rows).toEqual([{ get_process_operations_inbox: { summary: { blockedProcesses: 0, overdueTasks: 0, failedAutomations: 0, retryingAutomations: 0 }, page: 1, pageSize: 25, total: 0, totalPages: 0, items: [] } }])
    await db.query("select set_config('request.jwt.claim.sub', '', false)")
    await expect(db.query("select public.get_process_operations_inbox(null, 'ALL', 1, 25, 'nl')")).rejects.toThrow('AUTHENTICATION_REQUIRED')
  })
})
