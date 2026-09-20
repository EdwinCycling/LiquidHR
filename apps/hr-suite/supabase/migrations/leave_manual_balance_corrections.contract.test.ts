import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/20260913092334_leave_manual_balance_corrections.sql'
const foundationPath = 'supabase/migrations/20260722142551_add_leave_engine_foundation.sql'

describe('Leave manual balance corrections migration', () => {
  it('keeps the canonical RPC and adds an explicit effective-date overload', async () => {
    const sql = await readFile(migrationPath, 'utf8')

    expect(sql).toContain('alter table public.leave_accrual_transactions')
    expect(sql).toContain('add column if not exists actor_display_name text')
    expect(sql).toContain('internal_security.apply_group_leave_manual_adjustment_core(')
    expect(sql).toContain('requested_effective_date date')
    expect(sql).toContain('extract(year from requested_effective_date)::smallint')
    expect(sql).toContain('current_date')
    expect(sql).toContain("'HR_MANUAL_ADJUSTMENT'")
    expect(sql).toContain("'MANUAL_ADJUSTMENT'")
    expect(sql).toContain("'leave:adjust'")
    expect(sql).toContain('requested_employment_id')
    expect(sql).toContain("employment.record_status = 'CONFIRMED'")
    expect(sql).toContain('employment.deleted_at is null')
  })

  it('validates reasons, source keys, employment dates and locked effective years', async () => {
    const sql = await readFile(migrationPath, 'utf8')

    expect(sql).toContain("length(btrim(coalesce(requested_reason, ''))) not between 1 and 500")
    expect(sql).toContain("length(btrim(coalesce(requested_source_key, ''))) not between 8 and 160")
    expect(sql).toContain('requested_effective_date < target_employment.starts_on')
    expect(sql).toContain('target_employment.ends_on is not null')
    expect(sql).toContain("control.status = 'LOCKED'")
    expect(sql).toContain('control.year = requested_accrual_year')
    expect(sql).toContain('LEAVE_EMPLOYMENT_DATE_INVALID')
    expect(sql).toContain('LEAVE_YEAR_LOCKED')
    expect(sql).toContain('LEAVE_INSUFFICIENT_BALANCE')
  })

  it('keeps corrections in the canonical append-only ledger and excludes them from taken totals', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    const foundation = await readFile(foundationPath, 'utf8')

    expect(sql).not.toContain('create table public.leave_manual')
    expect(sql).toContain('set total_accrued = total_accrued + requested_amount')
    expect(sql).not.toContain('set total_taken = total_taken + abs(requested_amount)')
    expect(sql).toContain('actor_user_id')
    expect(sql).toContain('actor_display_name')
    expect(sql).toContain('transaction_date')
    expect(sql).toContain('on conflict')
    expect(foundation).toContain('create trigger leave_transactions_append_only')
    expect(foundation).toContain('prevent_leave_transaction_mutation')
  })

  it('keeps employee and direct-manager read scope separate from correction write scope', async () => {
    const sql = await readFile(migrationPath, 'utf8')

    expect(sql).toContain('internal_security.can_manage_employee(employee_id, \'employee:read\')')
    expect(sql).toContain("'self:leave:read'")
    expect(sql).toContain("'employee:read'")
    expect(sql).toContain("role.code = 'DIRECT_MANAGER'")
    expect(sql).toContain("permission.code = 'leave:read'")
    expect(sql).toContain('delete from public.role_permissions')
    expect(sql).not.toContain('grant update, delete on table public.leave_accrual_transactions')
  })
})
