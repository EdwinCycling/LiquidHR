import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const tenantId = '10000000-0000-4000-8000-000000000001'
const groupId = '20000000-0000-4000-8000-000000000001'
const cases = [
  { id: '30000000-0000-4000-8000-000000000001', processId: '40000000-0000-4000-8000-000000000001', clockStart: '2026-01-01', taskDue: '2026-10-22', name: 'regular weekday', expected: '2026-10-23 00:00:00' },
  { id: '30000000-0000-4000-8000-000000000002', processId: '40000000-0000-4000-8000-000000000002', clockStart: '2026-01-03', taskDue: '2026-10-24', name: 'Saturday', expected: '2026-10-25 00:00:00' },
  { id: '30000000-0000-4000-8000-000000000003', processId: '40000000-0000-4000-8000-000000000003', clockStart: '2026-03-06', taskDue: '2026-12-25', name: 'recognized public holiday', expected: '2026-12-26 00:00:00' },
  { id: '30000000-0000-4000-8000-000000000004', processId: '40000000-0000-4000-8000-000000000004', clockStart: '2026-01-10', taskDue: '2026-10-31', name: 'effective clock after a recovery gap', expected: '2026-11-01 00:00:00' },
]
const migration = readFileSync(new URL('./20261119160230_20261119120000_wvp_week42_pmux_deadline_contract.sql', import.meta.url), 'utf8')

let db: PGlite

async function materializeDeadline(processId: string, stepId: string) {
  const result = await db.query<{ localDeadline: string }>(
    "insert into public.process_step_instances (id, process_instance_id, step_key) values ($1, $2, 'wvp-week-42') returning to_char(deadline_at at time zone 'Europe/Amsterdam', 'YYYY-MM-DD HH24:MI:SS') as \"localDeadline\"",
    [stepId, processId],
  )
  expect(result.rows[0]).toBeDefined()
  return result.rows[0].localDeadline
}

describe('WVP week-42 PMUX deadline forward migration contract', () => {
  beforeAll(async () => {
    db = new PGlite()
    await db.exec([
      'create role anon;',
      'create role authenticated;',
      'create schema internal_security;',
      'create table public.hr_groups (tenant_id uuid not null, id uuid not null, time_zone text not null, primary key (tenant_id, id));',
      'create table public.absence_cases (tenant_id uuid not null, hr_group_id uuid not null, id uuid primary key, effective_clock_start_on date not null);',
      'create table public.process_instances (tenant_id uuid not null, hr_group_id uuid not null, id uuid primary key, idempotency_key text not null);',
      'create table public.absence_tasks (tenant_id uuid not null, hr_group_id uuid not null, case_id uuid not null, milestone_code text not null, due_on date not null);',
      'create table public.process_step_instances (id uuid primary key, process_instance_id uuid not null, step_key text not null, deadline_at timestamptz);',
      "create function internal_security.wvp_materialize_deadline() returns trigger language plpgsql security definer set search_path='' as $$ begin return new; end $$;",
      'create trigger zz_wvp_materialize_deadline before insert on public.process_step_instances for each row execute function internal_security.wvp_materialize_deadline();',
    ].join('\n'))

    await db.query('insert into public.hr_groups values ($1, $2, $3)', [tenantId, groupId, 'Europe/Amsterdam'])
    for (const item of cases) {
      await db.query('insert into public.absence_cases values ($1, $2, $3, $4)', [tenantId, groupId, item.id, item.clockStart])
      await db.query('insert into public.process_instances values ($1, $2, $3, $4)', [tenantId, groupId, item.processId, 'wvp01:' + item.id])
      await db.query('insert into public.absence_tasks values ($1, $2, $3, $4, $5)', [tenantId, groupId, item.id, 'WVP_WEEK_42', item.taskDue])
    }
    await db.query(
      "insert into public.process_step_instances values ($1, $2, 'wvp-week-42', $3)",
      ['50000000-0000-4000-8000-000000000001', cases[0].processId, '2030-01-01 00:00:00+00'],
    )
    await db.exec(migration)
  })

  afterAll(async () => {
    await db.close()
  })

  it.each(cases)('sets the inclusive PMUX deadline after the legal calendar date for $name', async (item) => {
    const stepId = item.id.replace('30000000', '60000000')
    await expect(materializeDeadline(item.processId, stepId)).resolves.toBe(item.expected)
  })

  it('leaves already activated PMUX snapshots unchanged', async () => {
    const result = await db.query<{ deadline: string }>(
      "select to_char(deadline_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as deadline from public.process_step_instances where id = '50000000-0000-4000-8000-000000000001'",
    )
    expect(result.rows[0].deadline).toBe('2030-01-01 00:00:00')
  })

  it('keeps trigger execution private and the function SECURITY DEFINER', async () => {
    const privileges = await db.query<{ anonCanExecute: boolean; authenticatedCanExecute: boolean; securityDefiner: boolean; emptySearchPath: boolean }>(
      "select has_function_privilege('anon', 'internal_security.wvp_materialize_deadline()', 'EXECUTE') as \"anonCanExecute\", has_function_privilege('authenticated', 'internal_security.wvp_materialize_deadline()', 'EXECUTE') as \"authenticatedCanExecute\", proc.prosecdef as \"securityDefiner\", 'search_path=\"\"' = any(proc.proconfig) as \"emptySearchPath\" from pg_proc proc join pg_namespace namespace on namespace.oid = proc.pronamespace where namespace.nspname = 'internal_security' and proc.proname = 'wvp_materialize_deadline'",
    )
    expect(privileges.rows[0]).toEqual({
      anonCanExecute: false,
      authenticatedCanExecute: false,
      securityDefiner: true,
      emptySearchPath: true,
    })
  })
})