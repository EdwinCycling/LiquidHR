import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./20261028162054_pay_w04_align_payfull02_work_hour_component.sql', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n')
const mappingRpc = 'public.save_actual_work_payroll_mapping(uuid,uuid,uuid,uuid,text,text,text,text,text,text,numeric,date)'
const actorId = '11111111-1111-4111-8111-111111111111'
const tenantId = '22222222-2222-4222-8222-222222222222'
const groupId = '33333333-3333-4333-8333-333333333333'
const administrationId = '44444444-4444-4444-8444-444444444444'
const workHourTypeId = '55555555-5555-4555-8555-555555555555'

async function createMappingSchemaFixture() {
  const db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create schema internal_security;
    create table auth.users (id uuid primary key);
    insert into auth.users (id) values ('${actorId}');
    create function auth.uid() returns uuid language sql stable as $$ select '${actorId}'::uuid $$;
    create function internal_security.current_user_has_hr_group_permission(uuid, uuid, text)
      returns boolean language sql stable as $$ select true $$;
    create function internal_security.current_user_has_audience_role(uuid, text[])
      returns boolean language sql stable as $$ select true $$;
    create table public.actual_work_payroll_mappings (
      id uuid primary key default gen_random_uuid(), tenant_id uuid not null, hr_group_id uuid not null,
      administration_id uuid not null, work_hour_type_id uuid not null, salary_component_id text,
      salary_component_code text, salary_component_version text, salary_component_output text,
      processing_target text not null, calculation_rule text not null, factor numeric(18,8),
      valid_from date not null, valid_until date, version_number integer not null default 1,
      supersedes_mapping_id uuid, created_by uuid not null references auth.users(id),
      created_at timestamptz not null default now(), updated_by uuid, updated_at timestamptz not null default now(),
      constraint actual_work_payroll_mappings_target_check check (
        (processing_target in ('INFORMATIONAL', 'TVT') and salary_component_id is null
          and salary_component_code is null and salary_component_version is null
          and salary_component_output is null and calculation_rule = 'NONE' and factor is null)
        or (processing_target = 'PAYMENT' and salary_component_id = 'system:payfull02:payfull02_variable_regular_wage'
          and salary_component_code = 'PAYFULL02_VARIABLE_REGULAR_WAGE'
          and salary_component_version = '2026.1-payfull02' and salary_component_output = 'amount'
          and calculation_rule = 'HOURLY_RATE_X_HOURS' and factor > 0)
      )
    );
    alter table public.actual_work_payroll_mappings enable row level security;
    create policy actual_work_payroll_mappings_read on public.actual_work_payroll_mappings
      for select to authenticated using (true);
    grant select on public.actual_work_payroll_mappings to authenticated;
    insert into public.actual_work_payroll_mappings (
      tenant_id, hr_group_id, administration_id, work_hour_type_id, processing_target,
      calculation_rule, valid_from, created_by
    ) values ('${tenantId}', '${groupId}', '${administrationId}', '${workHourTypeId}', 'TVT', 'NONE', '2026-10-01', '${actorId}');
  `)
  await db.exec(migration)
  return db
}

describe('W04 PAYFULL02 system input version alignment migration', () => {
  it('preserves existing non-payment mapping data, RLS and authorization grants', async () => {
    const db = await createMappingSchemaFixture()
    const [preserved, rls, policy, grants, constraint] = await Promise.all([
      db.query('select count(*)::integer as count from public.actual_work_payroll_mappings'),
      db.query("select relrowsecurity as enabled from pg_class where oid='public.actual_work_payroll_mappings'::regclass"),
      db.query("select count(*)::integer as count from pg_policies where schemaname='public' and tablename='actual_work_payroll_mappings' and policyname='actual_work_payroll_mappings_read'"),
      db.query(`select has_function_privilege('authenticated', '${mappingRpc}', 'EXECUTE') as authenticated, has_function_privilege('anon', '${mappingRpc}', 'EXECUTE') as anon`),
      db.query<{ definition: string }>("select pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.actual_work_payroll_mappings'::regclass and conname='actual_work_payroll_mappings_target_check'"),
    ])

    expect(preserved.rows[0]).toEqual({ count: 1 })
    expect(rls.rows[0]).toEqual({ enabled: true })
    expect(policy.rows[0]).toEqual({ count: 1 })
    expect(grants.rows[0]).toEqual({ authenticated: true, anon: false })
    expect(constraint.rows[0]?.definition).toContain("'2026.1'::text")
    expect(constraint.rows[0]?.definition).not.toContain('2026.1-payfull02')
  })

  it('accepts the real PAYFULL02 source version and rejects the package composition version', async () => {
    const db = await createMappingSchemaFixture()
    await db.query(`
      select public.save_actual_work_payroll_mapping(
        '${tenantId}', '${groupId}', '${administrationId}', '${workHourTypeId}', 'PAYMENT',
        'system:payfull02:payfull02_variable_regular_wage', 'PAYFULL02_VARIABLE_REGULAR_WAGE',
        '2026.1', 'amount', 'HOURLY_RATE_X_HOURS', 1, '2026-10-01'
      )
    `)

    await expect(db.query(`
      select public.save_actual_work_payroll_mapping(
        '${tenantId}', '${groupId}', '${administrationId}', '${workHourTypeId}', 'PAYMENT',
        'system:payfull02:payfull02_variable_regular_wage', 'PAYFULL02_VARIABLE_REGULAR_WAGE',
        '2026.1-payfull02', 'amount', 'HOURLY_RATE_X_HOURS', 1, '2026-10-01'
      )
    `)).rejects.toThrow('ACTUAL_WORK_PAYROLL_COMPONENT_SOURCE_GAP')
    const count = await db.query('select count(*)::integer as count from public.actual_work_payroll_mappings where processing_target = \'PAYMENT\'')
    expect(count.rows[0]).toEqual({ count: 1 })
  })
})
