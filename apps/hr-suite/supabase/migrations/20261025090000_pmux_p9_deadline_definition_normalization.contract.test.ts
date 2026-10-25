import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./20261025090000_pmux_p9_deadline_definition_normalization.sql', import.meta.url), 'utf8')
const deadlineSource = readFileSync(new URL('./20261023072351_pmux06a_materialize_process_sla_deadlines.sql', import.meta.url), 'utf8')
const runtimeSource = readFileSync(new URL('./20260808142249_process_automation_p4_runtime_engine.sql', import.meta.url), 'utf8')
function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`create or replace function internal_security.${name}(`)
  const end = source.indexOf('$$;', start)
  if (start < 0 || end < 0) throw new Error(`Missing source function: ${name}`)
  return source.slice(start, end + 3)
}
const originalFunction = extractFunction(deadlineSource, 'materialize_process_step_deadline')
const normalizer = extractFunction(runtimeSource, 'process_definition_content')
const originalRead = 'select version.definition_json into definition_content'
const normalizedRead = 'select internal_security.process_definition_content(version.definition_json) into definition_content'
const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005']
let db: PGlite

async function functionState() {
  return (await db.query<{ definition: string; acl: string | null; security: boolean; config: string[]; trigger_oid: number }>(`
    select pg_get_functiondef(p.oid) as definition, p.proacl::text as acl,
      p.prosecdef as security, p.proconfig as config,
      (select oid::integer from pg_trigger where tgname='deadline_fixture') as trigger_oid
    from pg_proc p where p.oid='internal_security.materialize_process_step_deadline()'::regprocedure
  `)).rows[0]
}

async function setDefinition(sla: unknown, wrapped = true) {
  const content = { startStepKey: 'request', steps: [{ key: 'request', sla }] }
  await db.query('update public.process_versions set definition_json=$1::jsonb', [JSON.stringify(wrapped ? { content } : content)])
}

async function activate(status = 'ACTIVE', stepKey = 'request') {
  return db.query<{ deadline: string | null }>(`
    insert into public.process_step_instances
      (tenant_id,hr_group_id,process_instance_id,process_version_id,step_key,status,activated_at)
    values ($1,$2,$3,$4,$5,$6,'2026-03-28T09:00:00Z')
    returning to_char(deadline_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') as deadline
  `, [ids[0], ids[1], ids[2], ids[3], stepKey, status])
}

describe('P9 deadline definition normalization', () => {
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`
      create schema internal_security;
      create table public.hr_groups(tenant_id uuid,id uuid,time_zone text);
      create table public.process_instances(tenant_id uuid,hr_group_id uuid,id uuid,process_definition_id uuid,process_version_id uuid);
      create table public.process_versions(tenant_id uuid,hr_group_id uuid,process_definition_id uuid,id uuid,definition_json jsonb);
      create table public.process_step_instances(tenant_id uuid,hr_group_id uuid,process_instance_id uuid,process_version_id uuid,step_key text,status text,activated_at timestamptz,deadline_at timestamptz);
      ${normalizer}
      ${originalFunction}
      revoke all on function internal_security.materialize_process_step_deadline() from public;
      create trigger deadline_fixture before insert on public.process_step_instances
        for each row execute function internal_security.materialize_process_step_deadline();
    `)
  })
  afterAll(async () => { await db?.close() })
  beforeEach(async () => {
    await db.exec('truncate public.process_step_instances,public.process_instances,public.process_versions,public.hr_groups;')
    await db.exec(originalFunction)
    await db.query('insert into public.hr_groups values($1,$2,$3)', [ids[0], ids[1], 'Europe/Amsterdam'])
    await db.query('insert into public.process_instances values($1,$2,$3,$4,$5)', [ids[0], ids[1], ids[2], ids[4], ids[3]])
    await db.query("insert into public.process_versions values($1,$2,$3,$4,'{}')", [ids[0], ids[1], ids[4], ids[3]])
  })

  it('reproduces the wrapped-version failure and resolves it through the existing normalizer', async () => {
    await setDefinition({ duration: { amount: 30, unit: 'MINUTES' } })
    await expect(activate()).rejects.toThrow('STEP_NOT_FOUND')
    await db.exec(migration)
    expect((await activate()).rows[0].deadline).toBe('2026-03-28T09:30:00Z')
  })

  it('preserves flat legacy versions and exact hour deadlines', async () => {
    await setDefinition({ duration: { amount: 2, unit: 'HOURS' } }, false)
    await db.exec(migration)
    expect((await activate()).rows[0].deadline).toBe('2026-03-28T11:00:00Z')
  })

  it('preserves local wall-clock calendar days across DST', async () => {
    await setDefinition({ duration: { amount: 1, unit: 'DAYS' }, businessDays: false })
    await db.exec(migration)
    expect((await activate()).rows[0].deadline).toBe('2026-03-29T08:00:00Z')
  })

  it('keeps the explicit workday-calendar requirement instead of weakening P9 semantics', async () => {
    await setDefinition({ duration: { amount: 2, unit: 'DAYS' }, businessDays: true })
    await db.exec(migration)
    await expect(activate()).rejects.toThrow('SLA_WORKDAY_CALENDAR_REQUIRED')
  })

  it('preserves no-SLA and inactive-step behavior', async () => {
    await setDefinition(null)
    await db.exec(migration)
    expect((await activate()).rows[0].deadline).toBeNull()
    await setDefinition({ duration: { amount: 2, unit: 'DAYS' }, businessDays: true })
    expect((await activate('COMPLETED')).rows[0].deadline).toBeNull()
  })

  it('still rejects missing steps and mismatched version scope', async () => {
    await setDefinition(null)
    await db.exec(migration)
    await expect(activate('ACTIVE', 'unknown')).rejects.toThrow('STEP_NOT_FOUND')
    await db.query('update public.process_versions set hr_group_id=$1', [ids[4]])
    await expect(activate()).rejects.toThrow('PROCESS_VERSION_NOT_FOUND')
  })

  it('changes exactly one source expression and preserves ACL, security, trigger identity and repeatability', async () => {
    const before = await functionState()
    await db.exec(migration)
    const after = await functionState()
    expect(after).toEqual({ ...before, definition: before.definition.replace(originalRead, normalizedRead) })
    await db.exec(migration)
    expect(await functionState()).toEqual(after)
  })
})
