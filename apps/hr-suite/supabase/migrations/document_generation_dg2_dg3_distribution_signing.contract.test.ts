import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/migrations/20260907071315_document_generation_dg2_dg3_distribution_signing.sql', 'utf8')

describe('DG2/DG3 distribution and signing migration contract', () => {
  it('adds scoped batch distribution around immutable DG1 snapshots', () => {
    expect(sql).toContain("create type public.document_generation_batch_status as enum ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED')")
    expect(sql).toContain('create table public.document_generation_batches')
    expect(sql).toContain('create table public.document_generation_batch_items')
    expect(sql).toContain('document_generation_batch_idempotency')
    expect(sql).toContain('document_generation_batch_audit')
    expect(sql).toContain('document_generation_batches_version_fk')
    expect(sql).toContain('alter table public.document_generation_batches enable row level security')
    expect(sql).toContain('grant execute on function public.create_document_generation_batch(jsonb) to service_role')
    expect(sql).toContain('document-distribution:write')
    expect(sql).toContain('employee_count < 1 or employee_count > 200')
    expect(sql).toContain('DOCUMENT_DISTRIBUTION_IDEMPOTENCY_CONFLICT')
    expect(sql).toContain('pg_advisory_xact_lock')
  })

  it('keeps signing provider-neutral and internal-only for DG3', () => {
    expect(sql).toContain("create type public.document_signing_status as enum ('PENDING', 'SIGNED', 'DECLINED', 'CANCELLED')")
    expect(sql).toContain('create table public.document_signing_requests')
    expect(sql).toContain('create table public.document_signing_events')
    expect(sql).toContain("provider_code text not null default 'INTERNAL' check (provider_code = 'INTERNAL')")
    expect(sql).toContain('document-signing:read')
    expect(sql).toContain('self:document-signing:write')
    expect(sql).toContain('grant execute on function public.prepare_document_signing')
    expect(sql).toContain('public.complete_document_signing(uuid, uuid) to service_role')
    expect(sql).toContain("event_type text not null check (event_type in ('PREPARED', 'SIGNED', 'DECLINED', 'CANCELLED'))")
    expect(sql).toContain('on conflict (tenant_id, hr_group_id, snapshot_id, signer_employee_id) do nothing')
    expect(sql).not.toContain('create table public.document_signing_providers')
    expect(sql).not.toContain('create table public.external_signing')
  })

  it('keeps employee access scoped to self or existing manager/HR rules', () => {
    expect(sql).toContain("internal_security.current_user_has_permission(document.tenant_id, document.administration_id, 'self:document:read')")
    expect(sql).toContain("request_row.signer_employee_id = internal_security.current_employee_id()")
    expect(sql).toContain("internal_security.can_manage_employee(request_row.employee_id, 'document-signing:read')")
    expect(sql).toContain('revoke all on public.document_signing_requests, public.document_signing_events from public, anon, authenticated')
  })
})
