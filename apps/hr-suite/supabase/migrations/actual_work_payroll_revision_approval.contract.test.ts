import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./20261027163113_actual_work_payroll_revision_approval.sql', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n')
const fingerprintStart = migration.indexOf('create or replace function internal_security.actual_work_payroll_entry_fingerprint(')
const fingerprintEnd = migration.indexOf('create or replace function public.approve_actual_work_entry_for_payroll_period(', fingerprintStart)
const releaseGuardStart = migration.indexOf('create or replace function internal_security.require_actual_work_payroll_approval_for_release()')
const releaseGuardEnd = migration.indexOf('drop trigger if exists actual_work_payroll_release_requires_approval', releaseGuardStart)
const immutableStart = migration.indexOf('create or replace function internal_security.reject_actual_work_payroll_approval_mutation()')
const immutableEnd = migration.indexOf('create or replace function internal_security.actual_work_payroll_entry_fingerprint(', immutableStart)
const fingerprintFunction = migration.slice(fingerprintStart, fingerprintEnd)
const releaseGuardFunction = migration.slice(releaseGuardStart, releaseGuardEnd)
const immutableFunction = migration.slice(immutableStart, immutableEnd)

const tenantId = '11111111-1111-4111-8111-111111111111'
const groupId = '22222222-2222-4222-8222-222222222222'
const administrationId = '33333333-3333-4333-8333-333333333333'
const employeeId = '44444444-4444-4444-8444-444444444444'
const employmentId = '55555555-5555-4555-8555-555555555555'
const entryId = '66666666-6666-4666-8666-666666666666'
const payrollPeriodId = '77777777-7777-4777-8777-777777777777'

async function applyMigrationToSchemaFixture() {
  const db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create schema internal_security;
    create schema extensions;
    create type public.leave_work_hour_entry_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');
    create type public.actual_work_revision_operation as enum ('CREATE', 'EDIT', 'CORRECTION');
    create type public.actual_work_entry_granularity as enum ('DAY', 'PERIOD');
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create function extensions.digest(bytea, text) returns bytea language sql immutable as $$
      select decode(md5($1), 'hex')
    $$;
    create function internal_security.current_user_has_hr_group_permission(uuid, uuid, text)
      returns boolean language sql stable as $$ select false $$;
    create function internal_security.current_user_has_permission(uuid, uuid, text)
      returns boolean language sql stable as $$ select false $$;
    create function internal_security.current_user_has_audience_role(uuid, text[])
      returns boolean language sql stable as $$ select false $$;
    create function internal_security.audit_configuration_change() returns trigger
      language plpgsql as $$ begin return new; end $$;
    create table public.hr_groups (
      id uuid primary key, tenant_id uuid not null, unique (tenant_id, id)
    );
    create table public.employments (
      id uuid primary key, tenant_id uuid not null, administration_id uuid not null,
      employee_id uuid not null, unique (tenant_id, administration_id, employee_id, id)
    );
    create table public.employment_work_hour_entries (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      administration_id uuid not null, employee_id uuid not null, employment_id uuid not null,
      work_hour_type_id uuid not null, work_date date, entry_granularity text not null,
      subject_period_start date not null, subject_period_end date not null,
      posting_period_start date not null, hours numeric not null,
      status public.leave_work_hour_entry_status not null, note text, correction_reason text,
      approved_at timestamptz, updated_at timestamptz not null,
      unique (tenant_id, hr_group_id, id)
    );
    create table public.actual_work_revisions (
      id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
      hr_group_id uuid not null, entry_id uuid not null, revision_number integer not null,
      unique (entry_id, revision_number)
    );
    create table public.actual_work_payroll_releases (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      administration_id uuid not null, employee_id uuid not null, employment_id uuid not null,
      entry_id uuid not null, entry_revision_number integer not null,
      payroll_period_id uuid, payroll_period_start date not null,
      payroll_period_end date, payroll_periodicity text
    );
    create table public.leave_types (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      is_active boolean not null, entitlement_mode text not null
    );
    create table public.leave_type_overtime_work_hours (
      tenant_id uuid not null, hr_group_id uuid not null, administration_id uuid,
      work_hour_type_id uuid not null, leave_type_id uuid not null
    );
    create function public.save_actual_work_entry(
      uuid, uuid, uuid, uuid, uuid, uuid, uuid,
      public.actual_work_entry_granularity, date, date, date, numeric,
      public.leave_work_hour_entry_status, text,
      public.actual_work_revision_operation, text
    ) returns public.employment_work_hour_entries language sql as $$
      select null::public.employment_work_hour_entries
    $$;
    create function public.post_actual_work_tvt_for_revision(uuid, uuid, uuid, uuid, integer)
      returns uuid language sql as $$ select null::uuid $$;
  `)
  await db.exec(migration)
  return db
}

async function createDatabase() {
  const db = new PGlite()
  await db.exec(`
    create schema internal_security;
    create schema extensions;
    create function extensions.digest(bytea, text) returns bytea language sql immutable as $$
      select decode(md5($1), 'hex')
    $$;
    create table public.employment_work_hour_entries (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      administration_id uuid not null, employee_id uuid not null, employment_id uuid not null,
      work_hour_type_id uuid not null, work_date date, entry_granularity text not null,
      subject_period_start date not null, subject_period_end date not null,
      posting_period_start date not null, hours numeric not null, status text not null,
      note text, correction_reason text, approved_at timestamptz, updated_at timestamptz not null
    );
    create table public.actual_work_revisions (
      tenant_id uuid not null, hr_group_id uuid not null, entry_id uuid not null,
      revision_number integer not null
    );
    create table public.actual_work_payroll_approvals (
      tenant_id uuid not null, hr_group_id uuid not null, administration_id uuid not null,
      employee_id uuid not null, employment_id uuid not null, entry_id uuid not null,
      entry_revision_number integer not null, reviewed_revision_number integer not null,
      payroll_period_id uuid not null, payroll_period_start date not null,
      payroll_period_end date not null, payroll_periodicity text not null,
      content_fingerprint text not null
    );
    create table public.actual_work_payroll_releases (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      administration_id uuid not null, employee_id uuid not null, employment_id uuid not null,
      entry_id uuid not null, entry_revision_number integer not null,
      payroll_period_id uuid not null, payroll_period_start date not null,
      payroll_period_end date not null, payroll_periodicity text not null,
      content_fingerprint text not null
    );
  `)
  await db.exec(fingerprintFunction)
  await db.exec(releaseGuardFunction)
  await db.exec(immutableFunction)
  await db.exec(`
    create trigger test_release_approval_guard before insert on public.actual_work_payroll_releases
    for each row execute function internal_security.require_actual_work_payroll_approval_for_release();
    create trigger test_approval_immutable before update or delete on public.actual_work_payroll_approvals
    for each row execute function internal_security.reject_actual_work_payroll_approval_mutation();
    insert into public.employment_work_hour_entries values (
      '${entryId}', '${tenantId}', '${groupId}', '${administrationId}', '${employeeId}', '${employmentId}',
      '88888888-8888-4888-8888-888888888888', '2026-10-20', 'DAY', '2026-10-20', '2026-10-21',
      '2026-10-01', 8, 'APPROVED', 'test', null, '2026-10-27T10:00:00Z', '2026-10-27T10:00:00Z'
    );
    insert into public.actual_work_revisions values ('${tenantId}', '${groupId}', '${entryId}', 3);
  `)
  return db
}

async function addApproval(db: Awaited<ReturnType<typeof createDatabase>>, revisionNumber: number) {
  const fingerprint = await db.query<{ value: string }>(`
    select internal_security.actual_work_payroll_entry_fingerprint(
      entry, $1, $2, '2026-10-01', '2026-10-31', 'MONTHLY'
    ) as value
    from public.employment_work_hour_entries entry where entry.id = $3
  `, [revisionNumber, payrollPeriodId, entryId])
  await db.query(`
    insert into public.actual_work_payroll_approvals values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, '2026-10-01', '2026-10-31', 'MONTHLY', $10
    )
  `, [tenantId, groupId, administrationId, employeeId, employmentId, entryId,
    revisionNumber, revisionNumber, payrollPeriodId, fingerprint.rows[0]!.value])
}

async function addRelease(db: Awaited<ReturnType<typeof createDatabase>>, revisionNumber: number) {
  await db.query(`
    insert into public.actual_work_payroll_releases values (
      '99999999-9999-4999-8999-999999999999', $1, $2, $3, $4, $5, $6, $7,
      $8, '2026-10-01', '2026-10-31', 'MONTHLY', 'pending'
    )
  `, [tenantId, groupId, administrationId, employeeId, employmentId, entryId,
    revisionNumber, payrollPeriodId])
}

describe('W04 revision-bound Payroll approval migration', () => {
  it('applies non-destructively to the existing Core table contracts and installs read-only RLS', async () => {
    const db = await applyMigrationToSchemaFixture()
    try {
      const state = await db.query<{ rls: boolean; select_grant: boolean; insert_grant: boolean; rows: number }>(`
        select c.relrowsecurity as rls,
          has_table_privilege('authenticated', 'public.actual_work_payroll_approvals', 'select') as select_grant,
          has_table_privilege('authenticated', 'public.actual_work_payroll_approvals', 'insert') as insert_grant,
          (select count(*)::int from public.actual_work_payroll_approvals) as rows
        from pg_class c where c.oid='public.actual_work_payroll_approvals'::regclass
      `)
      expect(state.rows[0]).toEqual({ rls: true, select_grant: true, insert_grant: false, rows: 0 })
      const functionState = await db.query<{ security_definer: boolean; execute_grant: boolean }>(`
        select p.prosecdef as security_definer,
          has_function_privilege('authenticated', p.oid, 'execute') as execute_grant
        from pg_proc p where p.oid =
          'public.approve_actual_work_entry_for_payroll_period(uuid,uuid,uuid,uuid,date,date,text,jsonb)'::regprocedure
      `)
      expect(functionState.rows[0]).toEqual({ security_definer: true, execute_grant: true })
    } finally {
      await db.close()
    }
  })

  it('keeps Payroll approval separate, scoped, immutable and tied to exact revisions', () => {
    expect(migration).toContain('create table public.actual_work_payroll_approvals')
    expect(migration).toContain('actual_work_payroll_approvals_entry_revision_unique')
    expect(migration).toContain('foreign key (tenant_id, administration_id, employee_id, employment_id)')
    expect(migration).toContain('references public.employments(tenant_id, administration_id, employee_id, id)')
    expect(migration).toContain('alter table public.actual_work_payroll_approvals enable row level security')
    expect(migration).toContain('grant select on table public.actual_work_payroll_approvals to authenticated')
    expect(migration).toContain('actual_work_payroll_approvals_immutable')
    expect(migration).toMatch(/approve_actual_work_entry_for_payroll_period\([\s\S]*?security definer\s+set search_path = ''/)
    expect(migration).toContain("array['HR_ADMIN', 'TENANT_ADMIN']")
    expect(migration).toContain('for update;')
    expect(migration).toContain('ACTUAL_WORK_PAYROLL_APPROVAL_REVISION_STALE')
    expect(migration).toContain('ACTUAL_WORK_PAYROLL_APPROVAL_PERIOD_CONFLICT')
    expect(migration).toContain('public.post_actual_work_tvt_for_revision(')
    expect(migration).toContain('actual_work_payroll_release_requires_approval')
    expect(migration).toContain('ACTUAL_WORK_PAYROLL_APPROVAL_FINGERPRINT_STALE')
  })

  it('blocks a release after an entry advances past its previously approved revision', async () => {
    const db = await createDatabase()
    try {
      await addApproval(db, 2)
      await expect(addRelease(db, 2)).rejects.toThrow('ACTUAL_WORK_PAYROLL_RELEASE_REVISION_STALE')
      const releases = await db.query('select id from public.actual_work_payroll_releases')
      expect(releases.rows).toHaveLength(0)
    } finally {
      await db.close()
    }
  })

  it('requires an approval with matching scope, period, revision and fingerprint', async () => {
    const db = await createDatabase()
    try {
      await expect(addRelease(db, 3)).rejects.toThrow('ACTUAL_WORK_PAYROLL_APPROVAL_REQUIRED')
      await addApproval(db, 3)
      await addRelease(db, 3)
      const releases = await db.query('select entry_revision_number from public.actual_work_payroll_releases')
      expect(releases.rows).toEqual([{ entry_revision_number: 3 }])
    } finally {
      await db.close()
    }
  })

  it('rejects changes to immutable Payroll approvals', async () => {
    const db = await createDatabase()
    try {
      await addApproval(db, 3)
      await expect(db.query(`update public.actual_work_payroll_approvals set content_fingerprint = 'changed'`))
        .rejects.toThrow('ACTUAL_WORK_PAYROLL_APPROVAL_IMMUTABLE')
    } finally {
      await db.close()
    }
  })
})
