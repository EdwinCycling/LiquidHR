import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'

const migrationUrl = new URL('./20261023083349_pmux06b_process_reminders_escalations.sql', import.meta.url)
const schedulerMigrationUrl = new URL('./20261023104819_pmux06b1_process_reminder_system_scheduler.sql', import.meta.url)
const tenantA = '00000000-0000-4000-8000-000000000001'
const tenantB = '00000000-0000-4000-8000-000000000002'
const groupA = '00000000-0000-4000-8000-000000000011'
const groupB = '00000000-0000-4000-8000-000000000012'
const instanceA = '00000000-0000-4000-8000-000000000021'
const versionA = '00000000-0000-4000-8000-000000000031'
const stepA = '00000000-0000-4000-8000-000000000041'
const itemA = '00000000-0000-4000-8000-000000000051'
const employeeA = '00000000-0000-4000-8000-000000000061'
const userA = '00000000-0000-4000-8000-000000000071'
const escalationEmployee = '00000000-0000-4000-8000-000000000081'
const escalationUser = '00000000-0000-4000-8000-000000000091'

let database: PGlite | null = null

async function createDatabase(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(String.raw`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create schema internal_security;
    create type public.workflow_job_type as enum ('PROCESS_REMINDER', 'PROCESS_DOCUMENT_OUTPUT');
    create type public.workflow_job_status as enum ('READY', 'RUNNING', 'RETRY', 'SUCCEEDED', 'DEAD_LETTER');
    create type public.process_instance_status as enum ('RUNNING', 'COMPLETED', 'REJECTED', 'CANCELLED');
    create type public.process_step_instance_status as enum ('ACTIVE', 'COMPLETED', 'CANCELLED');
    create type public.access_scope_type as enum ('TENANT');
    create type public.reminder_type as enum ('HR');
    create type public.reminder_target_type as enum ('EMPLOYEES');
    create type public.reminder_status as enum ('DRAFT', 'PUBLISHED', 'CANCELLED');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    grant execute on function auth.jwt() to anon, authenticated, service_role;
    create function internal_security.process_scope_has_permission(uuid, uuid, public.access_scope_type, uuid, text)
    returns boolean language sql stable as $$
      select auth.uid() = '00000000-0000-4000-8000-000000000071'::uuid and $5 = 'process-operations:write'
    $$;
    create function internal_security.process_definition_content(jsonb) returns jsonb language sql immutable as $$
      select case when jsonb_typeof($1 -> 'content') = 'object' then $1 -> 'content' else $1 end
    $$;
    create function internal_security.process_localized_text(jsonb, text, text) returns text language sql immutable as $$
      select coalesce($1 ->> case when $2 = 'en' then 'en' else 'nl' end, $1 ->> 'nl', $1 ->> 'en', $3)
    $$;
    create function internal_security.process_subject_context(uuid, uuid, uuid) returns jsonb language sql stable as $$
      select jsonb_build_object('employeeId', '00000000-0000-4000-8000-000000000061')
    $$;
    create function internal_security.resolve_process_assignment(uuid, uuid, public.access_scope_type, uuid, uuid, uuid, jsonb, uuid, uuid, date, timestamptz, timestamptz, jsonb, uuid)
    returns jsonb language sql stable as $$
      select jsonb_build_object('candidates', case when $7 ->> 'key' = 'no-candidate' then '[]'::jsonb
        else jsonb_build_array(jsonb_build_object('employeeId', '00000000-0000-4000-8000-000000000081', 'userId', '00000000-0000-4000-8000-000000000091')) end)
    $$;

    create table public.process_work_items (
      tenant_id uuid not null, hr_group_id uuid not null, id uuid not null,
      process_instance_id uuid not null, step_instance_id uuid not null,
      process_version_id uuid not null, step_key text not null, status text not null default 'OPEN',
      deadline_at timestamptz, claimed_by_user_id uuid,
      primary key (tenant_id, hr_group_id, id)
    );
    create table public.process_instances (
      tenant_id uuid not null, hr_group_id uuid not null, id uuid not null,
      process_definition_id uuid not null, process_version_id uuid not null,
      administration_id uuid not null, correlation_id uuid,
      status public.process_instance_status not null, scope_type public.access_scope_type not null,
      initiator_employee_id uuid, business_effective_date date, started_at timestamptz not null,
      metadata jsonb not null default '{}'::jsonb, primary key (tenant_id, hr_group_id, id)
    );
    create table public.process_versions (
      tenant_id uuid not null, hr_group_id uuid not null, process_definition_id uuid not null,
      id uuid not null, definition_json jsonb not null,
      primary key (tenant_id, hr_group_id, process_definition_id, id)
    );
    create table public.process_step_instances (
      tenant_id uuid not null, hr_group_id uuid not null, id uuid not null,
      process_instance_id uuid not null, process_version_id uuid not null, step_key text not null,
      status public.process_step_instance_status not null, activated_at timestamptz not null,
      deadline_at timestamptz, completed_at timestamptz, primary key (tenant_id, hr_group_id, id)
    );
    create table public.workflow_jobs (
      id uuid primary key default gen_random_uuid(), tenant_id uuid not null, hr_group_id uuid not null,
      administration_id uuid, process_instance_id uuid not null, step_instance_id uuid, work_item_id uuid,
      job_type public.workflow_job_type not null, status public.workflow_job_status not null default 'READY',
      available_at timestamptz not null default now(), idempotency_key text not null, correlation_id uuid,
      payload jsonb not null default '{}'::jsonb, attempts integer not null default 0, max_attempts integer not null default 5,
      locked_at timestamptz, locked_by uuid, last_attempt_at timestamptz, last_error_code text, last_error_at timestamptz,
      result_reference_id uuid, created_at timestamptz not null default now(),
      unique (tenant_id, hr_group_id, idempotency_key)
    );
    create table public.process_reminder_deliveries (
      id uuid primary key default gen_random_uuid(), tenant_id uuid not null, hr_group_id uuid not null,
      workflow_job_id uuid not null, process_instance_id uuid not null, step_instance_id uuid not null,
      reminder_id uuid not null, created_at timestamptz not null default now(),
      unique (tenant_id, hr_group_id, workflow_job_id), unique (tenant_id, hr_group_id, step_instance_id)
    );
    create table public.employees (
      tenant_id uuid not null, hr_group_id uuid not null, id uuid not null, auth_user_id uuid,
      is_active boolean not null default true, deleted_at timestamptz, primary key (tenant_id, hr_group_id, id)
    );
    create table public.process_work_item_candidates (
      tenant_id uuid not null, hr_group_id uuid not null, work_item_id uuid not null, employee_id uuid not null,
      candidate_user_id uuid, is_eligible boolean not null, resolution_revision integer not null
    );
    create table public.process_employee_subjects (
      tenant_id uuid not null, hr_group_id uuid not null, process_instance_id uuid not null, employee_id uuid not null
    );
    create table public.process_employment_subjects (
      tenant_id uuid not null, hr_group_id uuid not null, process_instance_id uuid not null,
      administration_id uuid, employment_id uuid
    );
    create table public.employments (
      tenant_id uuid not null, hr_group_id uuid not null, administration_id uuid, id uuid not null, employee_id uuid not null
    );
    create table public.reminders (
      tenant_id uuid not null, id uuid not null default gen_random_uuid(), administration_id uuid,
      created_by_user_id uuid not null, reminder_type public.reminder_type not null,
      target_type public.reminder_target_type not null, title text not null, description text,
      remind_at timestamptz not null, status public.reminder_status not null, published_at timestamptz,
      primary key (tenant_id, id)
    );
    create table public.reminder_targets (
      tenant_id uuid not null, administration_id uuid, reminder_id uuid not null, employee_id uuid not null
    );
    create table public.reminder_recipients (
      tenant_id uuid not null, reminder_id uuid not null, user_id uuid not null,
      employee_id uuid not null, effective_remind_at timestamptz not null
    );
    create table public.process_events (
      id uuid primary key default gen_random_uuid(), tenant_id uuid not null, hr_group_id uuid not null,
      process_instance_id uuid not null, work_item_id uuid, event_type text not null, payload jsonb not null,
      actor_user_id uuid, idempotency_key text not null,
      unique (tenant_id, hr_group_id, process_instance_id, idempotency_key)
    );
    create function internal_security.append_process_runtime_event(uuid, uuid, uuid, uuid, text, jsonb, uuid, uuid, text, uuid)
    returns uuid language plpgsql as $$
    declare inserted_id uuid;
    begin
      insert into public.process_events
        (tenant_id, hr_group_id, process_instance_id, work_item_id, event_type, payload, actor_user_id, idempotency_key)
      values ($1, $2, $3, $4, $5, $6, $7, $9)
      on conflict (tenant_id, hr_group_id, process_instance_id, idempotency_key)
      do update set idempotency_key = excluded.idempotency_key returning id into inserted_id;
      return inserted_id;
    end
    $$;
  `)
  const migration = (await readFile(migrationUrl, 'utf8')).replace(/\r\n/g, '\n')
  await db.exec(migration)
  await db.exec(`
    create function public.create_process_deadline_reminder(requested_job_id uuid, requested_language text default 'nl')
    returns jsonb language sql security invoker set search_path = '' as $$
      select internal_security.create_process_deadline_reminder(requested_job_id, requested_language)
    $$;
    revoke all on function public.create_process_deadline_reminder(uuid, text) from public, anon;
    grant usage on schema internal_security to authenticated;
    grant execute on function public.create_process_deadline_reminder(uuid, text) to authenticated;
  `)
  const schedulerMigration = (await readFile(schedulerMigrationUrl, 'utf8')).replace(/\r\n/g, '\n')
  await db.exec(schedulerMigration)
  await db.exec(`
    create trigger enqueue_process_step_jobs after insert on public.process_step_instances
    for each row execute function internal_security.enqueue_process_workflow_jobs();
  `)
  return db
}

function definition(input: {
  notifications?: { beforeDeadline: 'NONE' | 'ONE_HOUR' | 'TWENTY_FOUR_HOURS'; atDeadline: boolean }
  onBreach?: 'NOTIFY' | 'ESCALATE' | 'BLOCK'
  includeSla?: boolean
  noEscalationCandidate?: boolean
}) {
  const sla = input.includeSla === false ? undefined : {
    duration: { amount: 1, unit: 'HOURS' }, businessDays: false,
    onBreach: input.onBreach ?? 'NOTIFY', escalationParticipantKey: input.noEscalationCandidate ? 'no-candidate' : 'escalation',
    ...(input.notifications ? { notifications: input.notifications } : {}),
  }
  return {
    participants: [
      { key: 'escalation', label: { nl: 'HR-verantwoordelijke' } },
      { key: 'no-candidate', label: { nl: 'Geen beschikbare HR-verantwoordelijke' } },
    ],
    steps: [{ key: 'review', title: { nl: 'Aanvraag controleren', en: 'Review request' }, participantKey: 'assignee', ...(sla ? { sla } : {}) }],
  }
}

async function seedProcess(db: PGlite, input: {
  tenantId?: string; groupId?: string; instanceId?: string; versionId?: string; stepId?: string; itemId?: string
  definitionJson?: ReturnType<typeof definition>; instanceStatus?: 'RUNNING' | 'CANCELLED'
  workItemStatus?: 'OPEN' | 'CLAIMED' | 'COMPLETED' | 'CANCELLED'; deadlineAt?: string | null
} = {}) {
  const tenantId = input.tenantId ?? tenantA
  const groupId = input.groupId ?? groupA
  const instanceId = input.instanceId ?? instanceA
  const versionId = input.versionId ?? versionA
  const stepId = input.stepId ?? stepA
  const itemId = input.itemId ?? itemA
  const processDefinitionId = '00000000-0000-4000-8000-000000000101'
  const administrationId = '00000000-0000-4000-8000-000000000111'
  const deadlineAt = input.deadlineAt === undefined ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : input.deadlineAt
  const definitionJson = input.definitionJson ?? definition({ notifications: { beforeDeadline: 'ONE_HOUR', atDeadline: true } })

  await db.query('insert into public.process_versions (tenant_id, hr_group_id, process_definition_id, id, definition_json) values ($1, $2, $3, $4, $5::jsonb)', [tenantId, groupId, processDefinitionId, versionId, JSON.stringify(definitionJson)])
  await db.query("insert into public.process_instances (tenant_id, hr_group_id, id, process_definition_id, process_version_id, administration_id, status, scope_type, started_at) values ($1, $2, $3, $4, $5, $6, $7::public.process_instance_status, 'TENANT', now())", [tenantId, groupId, instanceId, processDefinitionId, versionId, administrationId, input.instanceStatus ?? 'RUNNING'])
  await db.query("insert into public.process_step_instances (tenant_id, hr_group_id, id, process_instance_id, process_version_id, step_key, status, activated_at, deadline_at) values ($1, $2, $3, $4, $5, 'review', 'ACTIVE', now(), $6::timestamptz)", [tenantId, groupId, stepId, instanceId, versionId, deadlineAt])
  await db.query("insert into public.process_work_items (tenant_id, hr_group_id, id, process_instance_id, step_instance_id, process_version_id, step_key, status, deadline_at) values ($1, $2, $3, $4, $5, $6, 'review', $7, $8::timestamptz)", [tenantId, groupId, itemId, instanceId, stepId, versionId, input.workItemStatus ?? 'OPEN', deadlineAt])
  return { tenantId, groupId, instanceId, versionId, stepId, itemId, administrationId }
}

async function addCandidate(db: PGlite, input: { tenantId?: string; groupId?: string; itemId?: string; employeeId?: string; userId?: string; revision?: number; eligible?: boolean }) {
  const tenantId = input.tenantId ?? tenantA
  const groupId = input.groupId ?? groupA
  const itemId = input.itemId ?? itemA
  const employeeId = input.employeeId ?? employeeA
  const userId = input.userId ?? userA
  await db.query('insert into public.employees (tenant_id, hr_group_id, id, auth_user_id, is_active) values ($1, $2, $3, $4, true) on conflict (tenant_id, hr_group_id, id) do update set auth_user_id = excluded.auth_user_id, is_active = true, deleted_at = null', [tenantId, groupId, employeeId, userId])
  await db.query('insert into public.process_work_item_candidates (tenant_id, hr_group_id, work_item_id, employee_id, candidate_user_id, is_eligible, resolution_revision) values ($1, $2, $3, $4, $5, $6, $7)', [tenantId, groupId, itemId, employeeId, userId, input.eligible ?? true, input.revision ?? 1])
}

async function runReminder(db: PGlite, jobId: string, actorId = userA) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [actorId])
  return db.query<{ result: { created: boolean; skipped?: boolean; blocked?: boolean; reminderId?: string } }>("select internal_security.create_process_deadline_reminder($1, 'nl') as result", [jobId])
}

async function jobIdFor(db: PGlite, work: { tenantId: string; groupId: string; itemId: string }, kind: string): Promise<string> {
  const result = await db.query<{ id: string }>("select id from public.workflow_jobs where tenant_id = $1 and hr_group_id = $2 and work_item_id = $3 and payload ->> 'deliveryKind' = $4", [work.tenantId, work.groupId, work.itemId, kind])
  const id = result.rows[0]?.id
  if (!id) throw new Error('Missing ' + kind + ' job')
  return id
}

describe('PMUX-06B reminder and escalation migration contract', () => {
  afterEach(async () => {
    await database?.close()
    database = null
  })

  it('runs only claimed due reminder jobs as SYSTEM and keeps the delivery audited and idempotent', async () => {
    database = await createDatabase()
    const work = await seedProcess(database)
    await addCandidate(database, {})
    const dueJobId = await jobIdFor(database, work, 'BEFORE_DEADLINE')
    await database.query("update public.workflow_jobs set available_at = now() - interval '1 minute' where id = $1", [dueJobId])
    const workerId = '00000000-0000-4000-8000-000000000099'
    const documentJob = await database.query<{ id: string }>("insert into public.workflow_jobs (tenant_id, hr_group_id, process_instance_id, job_type, idempotency_key, available_at) values ($1, $2, $3, 'PROCESS_DOCUMENT_OUTPUT', 'unrelated-document-job', now()) returning id", [work.tenantId, work.groupId, work.instanceId])

    await database.query("select set_config('request.jwt.claim.sub', '', false)")
    await database.query("select set_config('request.jwt.claims', $1, false)", ['{"role":"service_role"}'])
    await database.exec('set role service_role')
    const claimed = await database.query<{ job: { id: string; jobType: string } }>("select public.claim_process_reminder_job_system($1) as job", [workerId])
    const job = claimed.rows[0]?.job
    expect(job?.jobType).toBe('PROCESS_REMINDER')
    expect(job?.id).not.toBe(documentJob.rows[0]?.id)
    expect(job?.id).toBe(dueJobId)

    const created = await database.query<{ result: { created: boolean; reminderId: string } }>("select public.create_process_deadline_reminder_system($1, $2, 'nl') as result", [job!.id, workerId])
    expect(created.rows[0]?.result.created).toBe(true)
    const replay = await database.query<{ result: { created: boolean; reminderId: string } }>("select public.create_process_deadline_reminder_system($1, $2, 'nl') as result", [job!.id, workerId])
    expect(replay.rows[0]?.result).toMatchObject({ created: false, reminderId: created.rows[0]?.result.reminderId })

    const finished = await database.query<{ result: { status: string } }>("select public.finish_process_reminder_job_system($1, $2, 'SUCCEEDED') as result", [job!.id, workerId])
    expect(finished.rows[0]?.result.status).toBe('SUCCEEDED')
    await database.exec('reset role')
    const attribution = await database.query<{ created_by_user_id: string | null; created_by_actor_type: string }>('select created_by_user_id, created_by_actor_type from public.reminders')
    expect(attribution.rows).toEqual([{ created_by_user_id: null, created_by_actor_type: 'SYSTEM' }])
    const event = await database.query<{ actor_user_id: string | null; payload: { executionActor: string; executionPath: string } }>("select actor_user_id, payload from public.process_events where event_type = 'PROCESS_SLA_REMINDER_SENT'")
    expect(event.rows).toEqual([{ actor_user_id: null, payload: expect.objectContaining({ executionActor: 'SYSTEM', executionPath: 'SCHEDULED' }) }])
    expect(await database.query<{ count: number }>('select count(*)::int as count from public.process_reminder_deliveries')).toMatchObject({ rows: [{ count: 1 }] })

    const closed = await seedProcess(database, {
      instanceId: '00000000-0000-4000-8000-000000000025',
      versionId: '00000000-0000-4000-8000-000000000035',
      stepId: '00000000-0000-4000-8000-000000000045',
      itemId: '00000000-0000-4000-8000-000000000055',
    })
    await database.query("update public.process_work_items set status = 'COMPLETED' where tenant_id = $1 and hr_group_id = $2 and id = $3", [closed.tenantId, closed.groupId, closed.itemId])
    const closedJobId = await jobIdFor(database, closed, 'BEFORE_DEADLINE')
    await database.query("update public.workflow_jobs set available_at = now() - interval '1 minute' where id = $1", [closedJobId])
    await database.exec('set role service_role')
    const closedClaim = await database.query<{ job: { id: string } }>("select public.claim_process_reminder_job_system($1) as job", [workerId])
    expect(closedClaim.rows[0]?.job.id).toBe(closedJobId)
    const skipped = await database.query<{ result: { created: boolean; skipped: boolean } }>("select public.create_process_deadline_reminder_system($1, $2, 'nl') as result", [closedJobId, workerId])
    expect(skipped.rows[0]?.result).toMatchObject({ created: false, skipped: true })
    await database.query("select public.finish_process_reminder_job_system($1, $2, 'SUCCEEDED')", [closedJobId, workerId])
    await database.exec('reset role')
    expect(await database.query<{ count: number }>('select count(*)::int as count from public.reminders')).toMatchObject({ rows: [{ count: 1 }] })

    const grants = await database.query<{ anon_execute: boolean; user_execute: boolean; service_execute: boolean; user_private_execute: boolean; service_private_execute: boolean }>(`select
      has_function_privilege('anon', 'public.create_process_deadline_reminder_system(uuid, uuid, text)', 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', 'public.create_process_deadline_reminder_system(uuid, uuid, text)', 'EXECUTE') as user_execute,
      has_function_privilege('service_role', 'public.create_process_deadline_reminder_system(uuid, uuid, text)', 'EXECUTE') as service_execute,
      has_function_privilege('authenticated', 'internal_security.create_process_deadline_reminder(uuid, text)', 'EXECUTE') as user_private_execute,
      has_function_privilege('service_role', 'internal_security.create_process_deadline_reminder(uuid, text)', 'EXECUTE') as service_private_execute`)
    expect(grants.rows[0]).toEqual({ anon_execute: false, user_execute: false, service_execute: true, user_private_execute: true, service_private_execute: false })

    await database.query("select set_config('request.jwt.claims', $1, false)", ['{"role":"anon"}'])
    await database.exec('set role anon')
    await expect(database.query("select public.claim_process_reminder_job_system($1)", [workerId])).rejects.toThrow()
    await database.exec('reset role')
  }, 20000)

  it('creates one deterministic job for each configured event from the pinned version', async () => {
    database = await createDatabase()
    const work = await seedProcess(database, { deadlineAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() })
    const jobs = await database.query<{ idempotency_key: string; payload: { deliveryKind: string } }>("select idempotency_key, payload from public.workflow_jobs where work_item_id = $1 order by idempotency_key", [work.itemId])
    expect(jobs.rows.map((job) => job.payload.deliveryKind).sort()).toEqual(['AT_DEADLINE', 'BEFORE_DEADLINE', 'BREACH'])
    expect(jobs.rows.map((job) => job.idempotency_key).sort()).toEqual([
      'process-reminder:' + work.itemId + ':AT_DEADLINE',
      'process-reminder:' + work.itemId + ':BEFORE_DEADLINE',
      'process-reminder:' + work.itemId + ':BREACH',
    ])
    const times = await database.query<{ before_at: boolean; at_deadline: boolean; breach_after: boolean }>(`select
      exists(select 1 from public.workflow_jobs job where job.work_item_id = $1 and job.payload ->> 'deliveryKind' = 'BEFORE_DEADLINE' and job.available_at = (select item.deadline_at - interval '1 hour' from public.process_work_items item where item.id = $1)) as before_at,
      exists(select 1 from public.workflow_jobs job where job.work_item_id = $1 and job.payload ->> 'deliveryKind' = 'AT_DEADLINE' and job.available_at = (select item.deadline_at from public.process_work_items item where item.id = $1)) as at_deadline,
      exists(select 1 from public.workflow_jobs job where job.work_item_id = $1 and job.payload ->> 'deliveryKind' = 'BREACH' and job.available_at = (select item.deadline_at + interval '1 second' from public.process_work_items item where item.id = $1)) as breach_after`, [work.itemId])
    expect(times.rows[0]).toEqual({ before_at: true, at_deadline: true, breach_after: true })
    await database.query("update public.process_work_items set status = 'CLAIMED' where tenant_id = $1 and hr_group_id = $2 and id = $3", [work.tenantId, work.groupId, work.itemId])
    const count = await database.query<{ count: number }>("select count(*)::int as count from public.workflow_jobs where work_item_id = $1", [work.itemId])
    expect(count.rows[0]?.count).toBe(3)
  })

  it('preserves legacy subject reminders, sends new reminders to current assignees, and suppresses closed work', async () => {
    database = await createDatabase()
    const legacy = await seedProcess(database, { definitionJson: definition({ notifications: undefined }) })
    await database.query('insert into public.employees (tenant_id, hr_group_id, id, auth_user_id) values ($1, $2, $3, $4)', [tenantA, groupA, employeeA, userA])
    await database.query('insert into public.process_employee_subjects values ($1, $2, $3, $4)', [tenantA, groupA, instanceA, employeeA])
    const oldAssignee = '00000000-0000-4000-8000-000000000062'
    const oldUser = '00000000-0000-4000-8000-000000000072'
    await addCandidate(database, { employeeId: oldAssignee, userId: oldUser, revision: 1 })
    await addCandidate(database, { employeeId: employeeA, userId: userA, revision: 2 })
    const legacyJob = await database.query<{ id: string }>("select id from public.workflow_jobs where idempotency_key = $1", ['process-reminder:' + legacy.stepId])
    expect(legacyJob.rows).toHaveLength(1)
    const result = await runReminder(database, legacyJob.rows[0]!.id)
    expect(result.rows[0]?.result.created).toBe(true)
    expect((await runReminder(database, legacyJob.rows[0]!.id)).rows[0]?.result.created).toBe(false)
    const legacyRecipients = await database.query<{ user_id: string }>('select user_id from public.reminder_recipients')
    expect(legacyRecipients.rows).toEqual([{ user_id: userA }])

    const current = await seedProcess(database, {
      instanceId: '00000000-0000-4000-8000-000000000022',
      versionId: '00000000-0000-4000-8000-000000000032',
      stepId: '00000000-0000-4000-8000-000000000042',
      itemId: '00000000-0000-4000-8000-000000000052',
    })
    await addCandidate(database, { itemId: current.itemId, employeeId: oldAssignee, userId: oldUser, revision: 1 })
    await addCandidate(database, { itemId: current.itemId, employeeId: employeeA, userId: userA, revision: 2 })
    const beforeId = await jobIdFor(database, current, 'BEFORE_DEADLINE')
    const beforeResult = await runReminder(database, beforeId)
    expect(beforeResult.rows[0]?.result.created).toBe(true)
    const newRecipients = await database.query<{ reminder_id: string; user_id: string }>("select reminder_id, user_id from public.reminder_recipients order by reminder_id")
    expect(newRecipients.rows.map((row) => row.user_id)).toEqual([userA, userA])

    await database.query("update public.process_work_items set status = 'COMPLETED' where tenant_id = $1 and hr_group_id = $2 and id = $3", [current.tenantId, current.groupId, current.itemId])
    const atId = await jobIdFor(database, current, 'AT_DEADLINE')
    expect((await runReminder(database, atId)).rows[0]?.result.skipped).toBe(true)
    const cancelled = await seedProcess(database, {
      instanceId: '00000000-0000-4000-8000-000000000024',
      versionId: '00000000-0000-4000-8000-000000000034',
      stepId: '00000000-0000-4000-8000-000000000044',
      itemId: '00000000-0000-4000-8000-000000000054',
      workItemStatus: 'CANCELLED',
    })
    const cancelledJob = await database.query<{ id: string }>("insert into public.workflow_jobs (tenant_id, hr_group_id, process_instance_id, step_instance_id, work_item_id, job_type, idempotency_key, payload) values ($1, $2, $3, $4, $5, 'PROCESS_REMINDER', 'cancelled-item', jsonb_build_object('deliveryKind', 'BREACH')) returning id", [cancelled.tenantId, cancelled.groupId, cancelled.instanceId, cancelled.stepId, cancelled.itemId])
    expect((await runReminder(database, cancelledJob.rows[0]!.id)).rows[0]?.result.skipped).toBe(true)
    const reminderCount = await database.query<{ count: number }>('select count(*)::int as count from public.reminders')
    expect(reminderCount.rows[0]?.count).toBe(2)
  })

  it('escalates through the pinned participant and records blocked breaches without sending a reminder', async () => {
    database = await createDatabase()
    const escalated = await seedProcess(database, { definitionJson: definition({ onBreach: 'ESCALATE', notifications: { beforeDeadline: 'NONE', atDeadline: false } }) })
    const breachId = await jobIdFor(database, escalated, 'BREACH')
    expect((await runReminder(database, breachId)).rows[0]?.result.created).toBe(true)
    const escalatedRecipient = await database.query<{ user_id: string; employee_id: string }>('select user_id, employee_id from public.reminder_recipients')
    expect(escalatedRecipient.rows).toEqual([{ user_id: escalationUser, employee_id: escalationEmployee }])
    const blocked = await seedProcess(database, {
      instanceId: '00000000-0000-4000-8000-000000000023',
      versionId: '00000000-0000-4000-8000-000000000033',
      stepId: '00000000-0000-4000-8000-000000000043',
      itemId: '00000000-0000-4000-8000-000000000053',
      definitionJson: definition({ onBreach: 'BLOCK', notifications: { beforeDeadline: 'NONE', atDeadline: false } }),
    })
    const blockedId = await jobIdFor(database, blocked, 'BREACH')
    expect((await runReminder(database, blockedId)).rows[0]?.result.blocked).toBe(true)
    const events = await database.query<{ event_type: string }>('select event_type from public.process_events order by event_type')
    expect(events.rows.map((event) => event.event_type)).toEqual(['PROCESS_SLA_BREACH_BLOCKED', 'PROCESS_SLA_ESCALATED'])
    const count = await database.query<{ count: number }>('select count(*)::int as count from public.reminders')
    expect(count.rows[0]?.count).toBe(1)
  })

  it('rejects direct delivery without the existing process-operations write permission', async () => {
    database = await createDatabase()
    const work = await seedProcess(database)
    await addCandidate(database, {})
    const job = await jobIdFor(database, work, 'BEFORE_DEADLINE')
    await expect(runReminder(database, job, '00000000-0000-4000-8000-000000000099')).rejects.toThrow('PROCESS_REMINDER_FORBIDDEN')
    const reminders = await database.query<{ count: number }>('select count(*)::int as count from public.reminders')
    expect(reminders.rows[0]?.count).toBe(0)
  })

  it('scopes candidate selection by tenant and suppresses cancelled process instances', async () => {
    database = await createDatabase()
    const first = await seedProcess(database)
    const other = await seedProcess(database, {
      tenantId: tenantB, groupId: groupB,
      instanceId: '00000000-0000-4000-8000-000000000022',
      versionId: '00000000-0000-4000-8000-000000000032',
      stepId: '00000000-0000-4000-8000-000000000042',
      itemId: first.itemId,
    })
    await addCandidate(database, { tenantId: tenantB, groupId: groupB, itemId: other.itemId, employeeId: '00000000-0000-4000-8000-000000000062', userId: '00000000-0000-4000-8000-000000000072' })
    const firstJob = await jobIdFor(database, first, 'BEFORE_DEADLINE')
    const otherJob = await jobIdFor(database, other, 'BEFORE_DEADLINE')
    await expect(runReminder(database, firstJob)).rejects.toThrow('PROCESS_REMINDER_RECIPIENT_MISSING')
    expect((await runReminder(database, otherJob)).rows[0]?.result.created).toBe(true)
    const recipient = await database.query<{ tenant_id: string; user_id: string }>('select tenant_id, user_id from public.reminder_recipients')
    expect(recipient.rows).toEqual([{ tenant_id: tenantB, user_id: '00000000-0000-4000-8000-000000000072' }])

    const missing = await seedProcess(database, {
      instanceId: '00000000-0000-4000-8000-000000000023',
      versionId: '00000000-0000-4000-8000-000000000033',
      stepId: '00000000-0000-4000-8000-000000000043',
      itemId: '00000000-0000-4000-8000-000000000053',
      definitionJson: definition({ onBreach: 'ESCALATE', noEscalationCandidate: true, notifications: { beforeDeadline: 'NONE', atDeadline: false } }),
    })
    const missingJob = await jobIdFor(database, missing, 'BREACH')
    await expect(runReminder(database, missingJob)).rejects.toThrow('PROCESS_ESCALATION_RECIPIENT_MISSING')
  })
})
