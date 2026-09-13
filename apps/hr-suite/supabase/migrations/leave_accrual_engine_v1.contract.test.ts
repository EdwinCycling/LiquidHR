import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/20260912145426_leave_accrual_engine_v1.sql'
const cohortMigrationPath = 'supabase/migrations/20260912160000_leave_migration_opening_balance_cohorts.sql'
const idempotencyMigrationPath = 'supabase/migrations/20260912193500_leave_accrual_source_key_conflict.sql'

describe('Leave Engine V1 accrual posting migration', () => {
  it('seals the automatic accrual write boundary with HR-group authorization', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    expect(sql).toContain('create or replace function public.post_group_leave_accrual(')
    expect(sql).toContain('security definer')
    expect(sql).toContain('search_path = public, internal_security, auth')
    expect(sql).toContain("'leave:adjust'")
    expect(sql).toContain('requested_employment_id')
    expect(sql).toContain("employment.record_status = 'CONFIRMED'")
    expect(sql).toContain('employment.deleted_at is null')
  })

  it('keeps posting atomic, immutable and idempotent', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    expect(sql).toContain("'ACCRUAL'")
    expect(sql).toContain("'LEAVE_ACCRUAL'")
    expect(sql).toContain('on conflict (bucket_id, source_key) do nothing')
    expect(sql).toContain('set total_accrued = total_accrued + requested_amount')
    expect(sql).toContain('revoke all on function public.post_group_leave_accrual')
    expect(sql).toContain('from public, anon')
    expect(sql).toContain('grant execute on function public.post_group_leave_accrual')
  })

  it('blocks closed years and invalid period boundaries', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    expect(sql).toContain("control.status = 'LOCKED'")
    expect(sql).toContain('requested_period_end <= requested_period_start')
    expect(sql).toContain('requested_booking_date >= requested_period_end')
    expect(sql).toContain('requested_expiration_date < make_date')
  })

  it('preserves the existing migration opening-balance mechanism and adds independent cohorts', async () => {
    const sql = await readFile(cohortMigrationPath, 'utf8')
    expect(sql).toContain('add column if not exists cohort_key text')
    expect(sql).toContain('add column if not exists source_accrual_year smallint')
    expect(sql).toContain('drop constraint if exists leave_balance_buckets_tenant_id_administration_id_employmen_key')
    expect(sql).toContain('unique (tenant_id, hr_group_id, employment_id, leave_type_id, accrual_year, cohort_key)')
    expect(sql).toContain('create or replace function public.create_group_leave_opening_balance_cohort(')
    expect(sql).toContain("'MIGRATION_START_BALANCE'")
    expect(sql).toContain('requested_source_accrual_year')
    expect(sql).toContain('requested_expiration_date')
    expect(sql).toContain('create or replace function public.create_group_leave_opening_balance(')
    expect(sql).toContain('create or replace function public.post_group_leave_accrual(')
    expect(sql).toContain("automatic_cohort_key text := 'LEAVE_ACCRUAL:'")
  })

  it('keeps manual corrections on a separate source path', async () => {
    const sql = await readFile(cohortMigrationPath, 'utf8')
    expect(sql).toContain('create or replace function public.apply_group_leave_manual_adjustment(')
    expect(sql).toContain("'HR_MANUAL_ADJUSTMENT'")
    expect(sql).toContain('candidate.cohort_key = \'LEAVE_ACCRUAL:\'')
  })

  it('keeps the RPC idempotency conflict target compatible with the ledger index', async () => {
    const sql = await readFile(idempotencyMigrationPath, 'utf8')
    expect(sql).toContain('drop index if exists public.leave_accrual_transactions_source_key')
    expect(sql).toContain('create unique index leave_accrual_transactions_source_key')
    expect(sql).toContain('on public.leave_accrual_transactions (bucket_id, source_key)')
  })
})
