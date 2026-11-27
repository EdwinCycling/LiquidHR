import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

describe('voorlopige databasegrens', () => {
  it('maakt alle tabellen met RLS en zonder clientrechten', async () => {
    const db = new PGlite()
    const tenant = '00000000-0000-4000-8000-000000000001'
    const foreignTenant = '00000000-0000-4000-8000-000000000079'
    const group = '00000000-0000-4000-8000-000000000002'
    const otherGroup = '00000000-0000-4000-8000-000000000003'
    const foreignGroup = '00000000-0000-4000-8000-00000000007a'
    const foreignEmployee = '00000000-0000-4000-8000-00000000007b'
    try {
      await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema storage; create schema internal_security;
        create table auth.users (id uuid primary key);
        create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.auth_user', true), '')::uuid $$;
        create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('role', current_setting('test.jwt_role', true)) $$;
        create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
        create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
        create table public.tenants (id uuid primary key);
        create table public.hr_groups (id uuid primary key, tenant_id uuid not null, is_active boolean not null default true, time_zone text not null default 'Europe/Amsterdam', unique (tenant_id, id));
        create table public.administrations (id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null, is_active boolean not null default true, name text not null default 'Test administration', unique (tenant_id, hr_group_id, id));
        create table public.employees (id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null, deleted_at timestamptz, first_name text not null default '', birth_name text not null default '', employee_number text not null default gen_random_uuid()::text, is_active boolean not null default true, is_archived boolean not null default false, auth_user_id uuid, created_at timestamptz not null default now(), unique (tenant_id, hr_group_id, id));
        create table public.employee_organizations (tenant_id uuid not null, hr_group_id uuid not null, employee_id uuid not null, direct_manager_id uuid, effective_from date not null, effective_to date, id uuid primary key default gen_random_uuid(), administration_id uuid, employment_id uuid, department_id uuid, direct_manager_deputy_id uuid, job_id uuid, job_title text, location_id uuid);
        create table public.employments (id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null, employee_id uuid not null, record_status text not null default 'CONFIRMED', starts_on date not null default current_date, ends_on date, is_primary boolean not null default true, deleted_at timestamptz);
        create table public.departments (id uuid primary key, tenant_id uuid not null, name text not null, is_active boolean not null default true);
        create table public.jobs (id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null, is_active boolean not null default true);
        create table public.job_revisions (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, job_id uuid not null, name text not null, valid_from date not null, valid_until date);
        create table public.administration_locations (id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null, name text not null, is_active boolean not null default true, unique (tenant_id, hr_group_id, id));
        create table public.continuous_appraisal_items (id uuid primary key, tenant_id uuid not null, unique (tenant_id, id));
        create table public.permissions (id uuid primary key default gen_random_uuid(), code text unique, name text, category text, description text);
        create table public.management_roles (id uuid primary key default gen_random_uuid(), code text, tenant_id uuid);
        create table public.role_permissions (management_role_id uuid, permission_id uuid, unique (management_role_id, permission_id));
        create schema extensions;
        create function extensions.gen_random_uuid() returns uuid language sql volatile as $$ select gen_random_uuid() $$;
        create function extensions.digest(bytea, text) returns bytea language sql immutable as $$ select decode(md5($1::text) || md5($1::text), 'hex') $$;
        create type public.access_scope_type as enum ('TENANT');
        create type public.process_definition_status as enum ('DRAFT', 'PUBLISHED', 'RETIRED');
        create type public.process_instance_status as enum ('DRAFT', 'RUNNING', 'WAITING', 'BLOCKED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED');
        create type public.process_step_instance_status as enum ('PENDING', 'ACTIVE', 'BLOCKED', 'COMPLETED', 'REJECTED', 'CANCELLED');
        create type public.process_work_item_status as enum ('OPEN', 'CLAIMED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'BLOCKED');
        create type public.process_assignment_mode as enum ('EXACTLY_ONE', 'ANY_ONE', 'ALL');
        create table public.process_definitions (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, hr_group_id uuid not null, scope_type public.access_scope_type not null, key text not null, title jsonb not null, description jsonb, status public.process_definition_status not null, business_type text, business_category text, unique (tenant_id, hr_group_id, key));
        create table public.process_versions (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, hr_group_id uuid not null, process_definition_id uuid not null, version_number integer not null, schema_version integer not null, compiler_version text not null, definition_json jsonb not null, definition_hash text not null, unique (tenant_id, hr_group_id, process_definition_id, version_number));
        create table public.process_instances (id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null, scope_type public.access_scope_type not null, status public.process_instance_status not null, idempotency_key text not null, process_definition_id uuid not null, process_version_id uuid not null, administration_id uuid, current_step_key text, instance_version integer not null default 1, metadata jsonb not null default '{}'::jsonb, completed_at timestamptz, updated_at timestamptz default now());
        create table public.process_step_instances (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, hr_group_id uuid not null, process_instance_id uuid not null, process_version_id uuid not null, step_key text not null, status public.process_step_instance_status not null, activated_at timestamptz, completed_at timestamptz, deadline_at timestamptz, expected_version bigint not null default 1);
        create table public.process_work_items (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, hr_group_id uuid not null, process_instance_id uuid not null, step_instance_id uuid not null, step_key text not null, participant_key text not null, status public.process_work_item_status not null default 'OPEN', expected_version bigint not null default 1, assignee_employee_id uuid, claimed_by_user_id uuid, claimed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz default now());
        create table public.process_work_item_candidates (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, hr_group_id uuid not null, work_item_id uuid not null, employee_id uuid not null, candidate_user_id uuid, management_role_code text, resolution_revision integer not null default 1, resolution_policy text not null, resolution_date date not null, resolution_source text not null, is_eligible boolean not null, evidence jsonb not null default '{}'::jsonb);
        create table public.test_pmux_actions (work_item_id uuid, action text, idempotency_key text);
        grant select, insert on public.test_pmux_actions to authenticated;
        grant select, insert, update on public.process_instances, public.process_step_instances, public.process_work_items, public.process_work_item_candidates to authenticated;
        create function public.start_process(uuid, uuid, uuid, date, text, uuid) returns jsonb language plpgsql as $$
        declare instance_id uuid := gen_random_uuid(); definition_row public.process_definitions; version_row public.process_versions; step_id uuid := gen_random_uuid();
        begin
          select * into definition_row from public.process_definitions where id = $1;
          select * into version_row from public.process_versions where process_definition_id = $1 order by version_number desc limit 1;
          insert into public.process_instances (id, tenant_id, hr_group_id, scope_type, status, idempotency_key, process_definition_id, process_version_id) values (instance_id, definition_row.tenant_id, definition_row.hr_group_id, 'TENANT', 'RUNNING', $5, $1, version_row.id);
          insert into public.process_step_instances (id, tenant_id, hr_group_id, process_instance_id, process_version_id, step_key, status, activated_at) values (step_id, definition_row.tenant_id, definition_row.hr_group_id, instance_id, version_row.id, 'self-reflection', 'ACTIVE', now());
          insert into public.process_work_items (tenant_id, hr_group_id, process_instance_id, step_instance_id, step_key, participant_key, status) values (definition_row.tenant_id, definition_row.hr_group_id, instance_id, step_id, 'self-reflection', 'employee', 'OPEN');
          return jsonb_build_object('processInstanceId', instance_id);
        end $$;
        create function public.claim_process_work_item(requested_work_item_id uuid, requested_expected_version bigint) returns jsonb language plpgsql as $$
        declare item public.process_work_items;
        begin
          update public.process_work_items set status = 'CLAIMED', claimed_by_user_id = auth.uid(), claimed_at = now(), expected_version = expected_version + 1
          where id = requested_work_item_id and expected_version = requested_expected_version and status = 'OPEN' returning * into item;
          if item.id is null then raise exception 'STALE_ASSIGNMENT'; end if;
          insert into public.test_pmux_actions values (item.id, 'CLAIM', 'claim:' || item.id::text);
          return jsonb_build_object('workItemId', item.id, 'status', item.status);
        end $$;
        create function public.perform_process_work_item_action(uuid, text, bigint, bigint, text, uuid) returns jsonb language plpgsql security definer set search_path = public, internal_security, pg_temp as $$
        begin
          begin if $2 in ('SUBMIT', 'RELEASE') then perform internal_security.prepare_process_form_action($1, $2); perform internal_security.process_form_runtime_fields($1); end if;
          exception when others then raise exception 'TEST_ACTION_FAILED work_item=% action=% reason=%', $1, $2, sqlerrm; end;
          insert into public.test_pmux_actions values ($1, $2, $5);
          update public.process_work_items set status = 'COMPLETED', expected_version = expected_version + 1 where id = $1;
          return jsonb_build_object('workItemId', $1);
        end $$;
        create function public.reassign_process_work_item(uuid, bigint, uuid) returns jsonb language plpgsql as $$
        begin update public.process_work_items set assignee_employee_id = $3, status = 'OPEN', expected_version = expected_version + 1 where id = $1 and expected_version = $2; return jsonb_build_object('workItemId', $1); end $$;`)
      await db.exec(`create function internal_security.current_user_has_hr_group_permission(uuid, uuid, text) returns boolean language sql stable as $$ select current_setting('test.hr', true) = 'true' $$;
        create function internal_security.current_employee_id(uuid, uuid) returns uuid language sql stable as $$ select nullif(current_setting('test.employee', true), '')::uuid $$;
        create function internal_security.can_manage_employee(uuid, text) returns boolean language sql stable as $$ select current_setting('test.manager', true) = 'true' $$;
        create function internal_security.process_form_runtime_fields(uuid) returns jsonb language plpgsql stable as $$ begin raise exception 'LEGACY_FORM_RUNTIME_REACHED'; end $$;
        create function internal_security.prepare_process_form_action(uuid, text) returns void language plpgsql as $$ begin raise exception 'LEGACY_FORM_VALIDATION_REACHED'; end $$;
        create function internal_security.resolve_process_assignment(uuid, uuid, public.access_scope_type, uuid, uuid, uuid, jsonb, uuid, uuid, date, timestamptz, timestamptz, jsonb, uuid) returns jsonb language plpgsql stable as $$ declare manager_id uuid; department_id uuid; begin execute 'select min(organization.direct_manager_id), min(organization.department_id) from public.employee_organizations organization' into manager_id, department_id; return jsonb_build_object('managerId', manager_id, 'departmentId', department_id); end $$;
        grant usage on schema internal_security to authenticated;
        grant execute on all functions in schema internal_security to authenticated;`)
      await db.query('insert into public.tenants values ($1), ($2)', [tenant, foreignTenant])
      await db.query('insert into public.hr_groups (id, tenant_id) values ($1, $2), ($3, $2), ($4, $5)', [group, tenant, otherGroup, foreignGroup, foreignTenant])
      await db.query('insert into public.employees (id, tenant_id, hr_group_id) values ($1, $2, $3)', [foreignEmployee, foreignTenant, foreignGroup])
      await db.exec(readFileSync('supabase/migrations/20261122163130_performance_reviews_mvp.sql', 'utf8'))
      await db.exec(readFileSync('supabase/migrations/20261122170109_performance_reviews_pmux_runtime.sql', 'utf8'))
      await db.exec(readFileSync('supabase/migrations/20261122172000_performance_reviews_attachments_pmux_hardening.sql', 'utf8'))
      await db.exec(readFileSync('supabase/migrations/20261123194059_performance_reviews_security_index_hardening.sql', 'utf8'))
      await db.exec(readFileSync('supabase/migrations/20261123201233_performance_reviews_pmux_claim_before_advance.sql', 'utf8'))
      await db.exec(readFileSync('supabase/migrations/20261123204500_performance_reviews_pmux_domain_owned_forms.sql', 'utf8'))
      await db.exec(readFileSync('supabase/migrations/20261123205000_performance_reviews_pmux_domain_form_runtime.sql', 'utf8'))
      await db.exec(readFileSync('supabase/migrations/20261123214000_pmux_uuid_assignment_aggregation.sql', 'utf8'))
      await db.exec(readFileSync('supabase/migrations/20261123214500_performance_review_draft_status.sql', 'utf8'))
      await db.exec(readFileSync('supabase/migrations/20261125133606_performance_review_draft_update.sql', 'utf8'))
      await db.exec(readFileSync('supabase/migrations/20261125150432_performance_review_scheduled_activation.sql', 'utf8'))
      await db.exec(readFileSync('supabase/migrations/20261125201505_performance_review_close_conflict.sql', 'utf8'))
      await db.exec(readFileSync('supabase/migrations/20261126210000_performance_reviews_additional_reviewer_v2.sql', 'utf8'))
      const result = await db.query<{ relname: string; relrowsecurity: boolean; readable: boolean }>(`
        select c.relname, c.relrowsecurity, has_table_privilege('authenticated', c.oid, 'SELECT') as readable
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname like 'performance_review_%' and c.relkind = 'r'`)
      expect(result.rows).toHaveLength(13)
      expect(result.rows.every(row => row.relrowsecurity)).toBe(true)
      expect(result.rows.filter(row => ['performance_review_audit_events', 'performance_review_command_results'].includes(row.relname)).every(row => !row.readable)).toBe(true)
      const indexCount = await db.query<{ count: string }>(`select count(*)::text as count from pg_indexes where schemaname = 'public' and indexname like 'performance_review_%_idx'`)
      expect(Number(indexCount.rows[0]?.count)).toBeGreaterThanOrEqual(16)
      const denyPolicies = await db.query<{ policyname: string }>(`select policyname from pg_policies where schemaname = 'public' and policyname in ('performance_review_audit_events_deny_direct', 'performance_review_command_results_deny_direct') order by policyname`)
      expect(denyPolicies.rows.map(row => row.policyname)).toEqual(['performance_review_audit_events_deny_direct', 'performance_review_command_results_deny_direct'])
      const functionGrants = await db.query<{ allowed: boolean }>(`select has_function_privilege('anon', 'public.create_performance_review_round(uuid,text,text,date,date,date,date,jsonb,text,text)', 'EXECUTE') as allowed`)
      expect(functionGrants.rows[0]?.allowed).toBe(false)
      const draftUpdateGrant = await db.query<{ allowed: boolean }>(`select has_function_privilege('anon', 'public.update_performance_review_round(uuid,text,text,text,date,date,date,date,jsonb,integer)', 'EXECUTE') as allowed`)
      expect(draftUpdateGrant.rows[0]?.allowed).toBe(false)
      const scheduledActivationGrants = await db.query<{ anon_allowed: boolean; authenticated_allowed: boolean; service_role_allowed: boolean }>(`select
        has_function_privilege('anon', 'public.run_due_performance_review_activations()', 'EXECUTE') as anon_allowed,
        has_function_privilege('authenticated', 'public.run_due_performance_review_activations()', 'EXECUTE') as authenticated_allowed,
        has_function_privilege('service_role', 'public.run_due_performance_review_activations()', 'EXECUTE') as service_role_allowed`)
      expect(scheduledActivationGrants.rows[0]).toEqual({ anon_allowed: false, authenticated_allowed: false, service_role_allowed: true })
      const admin = '00000000-0000-4000-8000-000000000004'
      const employee = '00000000-0000-4000-8000-000000000005'
      const reviewer = '00000000-0000-4000-8000-000000000006'
      const user = '00000000-0000-4000-8000-000000000007'
      const nextReviewer = '00000000-0000-4000-8000-00000000000d'
      const nextReviewerUser = '00000000-0000-4000-8000-00000000000e'
      const v2Reviewer = '00000000-0000-4000-8000-000000000061'
      const v2ReviewerUser = '00000000-0000-4000-8000-000000000062'
      const bulkEmployeeUser = '00000000-0000-4000-8000-000000000063'
      const v2Administration = '00000000-0000-4000-8000-00000000007c'
      const wrongAdministration = '00000000-0000-4000-8000-00000000007d'
      let processDefinition = ''
      let processVersion = ''
      const round = '00000000-0000-4000-8000-000000000008'
      const dueRound = '00000000-0000-4000-8000-000000000041'
      const futureRound = '00000000-0000-4000-8000-000000000042'
      await db.query('insert into auth.users values ($1), ($2), ($3), ($4)', [user, nextReviewerUser, v2ReviewerUser, bulkEmployeeUser])
      await db.query('insert into public.administrations (id, tenant_id, hr_group_id) values ($1, $2, $3), ($4, $2, $5), ($6, $2, $3)', [admin, tenant, otherGroup, v2Administration, group, wrongAdministration])
      await db.query('insert into public.employees (id, tenant_id, hr_group_id, auth_user_id) values ($1, $2, $3, $4), ($5, $2, $3, $6)', [employee, tenant, group, user, reviewer, user])
      await db.query('insert into public.employees (id, tenant_id, hr_group_id, auth_user_id, first_name, birth_name) values ($1, $2, $3, $4, \'Mila\', \'Beoordelaar\')', [nextReviewer, tenant, group, nextReviewerUser])
      await db.query('insert into public.employees (id, tenant_id, hr_group_id, auth_user_id, first_name, birth_name) values ($1, $2, $3, $4, \'Noor\', \'Onafhankelijk\')', [v2Reviewer, tenant, group, v2ReviewerUser])
      await db.query("insert into public.employee_organizations (tenant_id, hr_group_id, employee_id, direct_manager_id, effective_from, effective_to, administration_id) values ($1, $2, $3, $4, '2020-01-01', null, $5)", [tenant, group, employee, reviewer, admin])
      await db.query("insert into public.employments (id, tenant_id, hr_group_id, employee_id) values ($1, $2, $3, $4)", [admin, tenant, group, employee])
      await db.query("insert into public.employments (id, tenant_id, hr_group_id, employee_id) values ('00000000-0000-4000-8000-000000000024', $1, $2, $3), ('00000000-0000-4000-8000-000000000025', $1, $2, $4)", [tenant, group, reviewer, nextReviewer])
      await db.query("insert into public.employee_organizations (tenant_id, hr_group_id, employee_id, effective_from, effective_to, administration_id) values ($1, $2, $3, '2020-01-01', null, $4), ($1, $2, $5, '2020-01-01', null, $4)", [tenant, group, reviewer, admin, nextReviewer])
      await db.query("insert into public.employee_organizations (tenant_id, hr_group_id, employee_id, effective_from, effective_to, administration_id) values ($1, $2, $3, '2020-01-01', null, $4)", [tenant, group, v2Reviewer, admin])
      await db.query("insert into public.employee_organizations (tenant_id, hr_group_id, employee_id, effective_from, effective_to, administration_id) values ($1, $2, $3, '2020-01-01', null, $4), ($1, $2, $5, '2020-01-01', null, $4), ($1, $2, $6, '2020-01-01', null, $4), ($1, $2, $7, '2020-01-01', null, $4)", [tenant, group, employee, v2Administration, reviewer, nextReviewer, v2Reviewer])
      await db.query("update public.employee_organizations set direct_manager_deputy_id = $1 where employee_id = $2 and tenant_id = $3", [nextReviewer, employee, tenant])
      const department = '00000000-0000-4000-8000-000000000036'
      await db.query('update public.employee_organizations set department_id = $1 where tenant_id = $2 and employee_id = $3', [department, tenant, employee])
      const resolvedAssignment = await db.query<{ assignment: { managerId: string; departmentId: string } }>("select internal_security.resolve_process_assignment(null::uuid, null::uuid, null::public.access_scope_type, null::uuid, null::uuid, null::uuid, null::jsonb, null::uuid, null::uuid, null::date, null::timestamptz, null::timestamptz, null::jsonb, null::uuid) as assignment")
      expect(resolvedAssignment.rows[0]?.assignment.managerId).toBe(reviewer)
      expect(resolvedAssignment.rows[0]?.assignment.departmentId).toBe(department)
      processDefinition = (await db.query<{ id: string }>("select id from public.process_definitions where tenant_id = $1 and hr_group_id = $2 and key = 'performance-review-mvp'", [tenant, group])).rows[0]?.id ?? ''
      processVersion = (await db.query<{ id: string }>("select id from public.process_versions where tenant_id = $1 and hr_group_id = $2 and process_definition_id = $3 and version_number = 1", [tenant, group, processDefinition])).rows[0]?.id ?? ''
      const reviewInstance = '00000000-0000-4000-8000-000000000030'
      const reviewSelfWorkItem = '00000000-0000-4000-8000-000000000031'
      const reviewManagerWorkItem = '00000000-0000-4000-8000-000000000032'
      const genericDefinition = '00000000-0000-4000-8000-000000000033'
      const genericInstance = '00000000-0000-4000-8000-000000000034'
      const genericWorkItem = '00000000-0000-4000-8000-000000000035'
      await db.query("insert into public.process_definitions (id, tenant_id, hr_group_id, scope_type, key, title, status, business_type, business_category) values ($1, $2, $3, 'TENANT', 'generic-process', '{\"nl\":\"Algemeen\"}', 'PUBLISHED', 'P_MUTATION', 'GENERAL')", [genericDefinition, tenant, group])
      await db.query("insert into public.process_instances (id, tenant_id, hr_group_id, scope_type, status, idempotency_key, process_definition_id, process_version_id, current_step_key) values ($1, $2, $3, 'TENANT', 'RUNNING', 'review-form-probe', $4, $5, 'self-reflection'), ($6, $2, $3, 'TENANT', 'RUNNING', 'generic-form-probe', $7, $5, 'other-step')", [reviewInstance, tenant, group, processDefinition, processVersion, genericInstance, genericDefinition])
      await db.query("insert into public.process_work_items (id, tenant_id, hr_group_id, process_instance_id, step_instance_id, step_key, participant_key) values ($1, $2, $3, $4, gen_random_uuid(), 'self-reflection', 'employee'), ($5, $2, $3, $6, gen_random_uuid(), 'manager-response', 'manager'), ($7, $2, $3, $8, gen_random_uuid(), 'other-step', 'employee')", [reviewSelfWorkItem, tenant, group, reviewInstance, reviewManagerWorkItem, reviewInstance, genericWorkItem, genericInstance])
      await db.query('select internal_security.prepare_process_form_action($1, \'SUBMIT\'), internal_security.prepare_process_form_action($2, \'SUBMIT\')', [reviewSelfWorkItem, reviewManagerWorkItem])
      const reviewRuntimeFields = await db.query<{ fields: Record<string, unknown> }>('select internal_security.process_form_runtime_fields($1) as fields', [reviewSelfWorkItem])
      expect(reviewRuntimeFields.rows[0]?.fields).toEqual({})
      await expect(db.query("select internal_security.prepare_process_form_action($1, 'SUBMIT')", [genericWorkItem])).rejects.toThrow(/LEGACY_FORM_VALIDATION_REACHED/)
      await expect(db.query('select internal_security.process_form_runtime_fields($1)', [genericWorkItem])).rejects.toThrow(/LEGACY_FORM_RUNTIME_REACHED/)
      await db.query(`insert into public.performance_review_rounds (id, tenant_id, hr_group_id, title, introduction, period_start, period_end, start_date, created_by)
        values ($1, $2, $3, 'Gesprek', 'Inleiding', '2026-01-01', '2026-12-31', '2026-11-22', $4)`, [round, tenant, group, user])
      await db.query(`insert into public.performance_review_rounds (id, tenant_id, hr_group_id, title, introduction, period_start, period_end, start_date, status, created_by)
        values ($1, $2, $3, 'Geplande startbare ronde', 'Start via de PMUX-scheduler.', '2000-01-01', '2099-12-31', '2000-01-01', 'SCHEDULED', $4),
          ($5, $2, $3, 'Nog niet startbare ronde', 'Blijft gepland tot de startdatum.', '2099-01-01', '2099-12-31', '2099-01-01', 'SCHEDULED', $4)`, [dueRound, tenant, group, user, futureRound])
      await db.query("update public.performance_review_rounds set status = 'ACTIVE' where id = $1", [round])
      await expect(db.query("update public.performance_review_rounds set title = 'Andere inhoud' where id = $1", [round])).rejects.toThrow(/PERFORMANCE_ROUND_CONFIG_IMMUTABLE/)
      await expect(db.query("update public.performance_review_rounds set due_date = '2027-01-31' where id = $1", [round])).rejects.toThrow(/PERFORMANCE_ROUND_CONFIG_IMMUTABLE/)
      await expect(db.query(`insert into public.performance_review_dossiers (tenant_id, hr_group_id, round_id, administration_id, employee_id, reviewer_employee_id)
        values ($1, $2, $3, $4, $5, $6)`, [tenant, group, round, admin, employee, reviewer])).rejects.toThrow(/foreign key/i)
      await db.query('update public.administrations set hr_group_id = $1 where id = $2', [group, admin])
      const otherEmployee = '00000000-0000-4000-8000-00000000000a'
      await db.query('insert into public.employees (id, tenant_id, hr_group_id) values ($1, $2, $3)', [otherEmployee, tenant, otherGroup])
      const secondEmployee = '00000000-0000-4000-8000-00000000000b'
      await db.query('insert into public.employees (id, tenant_id, hr_group_id, auth_user_id) values ($1, $2, $3, $4)', [secondEmployee, tenant, group, bulkEmployeeUser])
      await db.query("insert into public.employee_organizations (tenant_id, hr_group_id, employee_id, direct_manager_id, effective_from, effective_to, administration_id, employment_id) values ($1, $2, $3, $4, '2020-01-01', null, $5, $6)", [tenant, group, secondEmployee, reviewer, admin, '00000000-0000-4000-8000-00000000000c'])
      await db.query("insert into public.employee_organizations (tenant_id, hr_group_id, employee_id, effective_from, effective_to, administration_id) values ($1, $2, $3, '2020-01-01', null, $4)", [tenant, group, secondEmployee, v2Administration])
      const dossier = '00000000-0000-4000-8000-000000000009'
      await db.query(`insert into public.performance_review_dossiers (id, tenant_id, hr_group_id, round_id, administration_id, employee_id, reviewer_employee_id)
        values ($1, $2, $3, $4, $5, $6, $7)`, [dossier, tenant, group, round, admin, employee, reviewer])
      await expect(db.query("update public.performance_review_dossiers set phase = 'COMPLETED_AGREED' where id = $1", [dossier])).rejects.toThrow(/PERFORMANCE_TRANSITION_FORBIDDEN/)
      await db.query("update public.performance_review_dossiers set phase = 'WAITING_MANAGER' where id = $1", [dossier])
      await expect(db.query("update public.performance_review_dossiers set phase = 'WAITING_EMPLOYEE' where id = $1", [dossier])).rejects.toThrow(/PERFORMANCE_TRANSITION_FORBIDDEN/)
      await db.query(`insert into public.performance_review_submissions (tenant_id, dossier_id, kind, author_user_id, body, submitted_at)
        values ($1, $2, 'SELF', $3, 'Definitieve reflectie', now())`, [tenant, dossier, user])
      await expect(db.query("update public.performance_review_submissions set body = 'Aangepast'")).rejects.toThrow(/PERFORMANCE_SUBMISSION_IMMUTABLE/)
      await expect(db.query('delete from public.performance_review_submissions')).rejects.toThrow(/PERFORMANCE_SUBMISSION_IMMUTABLE/)
      await db.query("insert into public.performance_review_acknowledgements (tenant_id, dossier_id, actor_user_id, decision) values ($1, $2, $3, 'AGREE')", [tenant, dossier, user])
      await expect(db.query("update public.performance_review_acknowledgements set decision = 'DISAGREE', reason = 'Anders'")).rejects.toThrow(/PERFORMANCE_HISTORY_IMMUTABLE/)
      await db.exec('set role authenticated')
      const privateBefore = await db.query('select * from public.performance_review_private_notes')
      expect(privateBefore.rows).toHaveLength(0)

      await db.query("select set_config('test.auth_user', $1, false), set_config('test.hr', 'true', false), set_config('test.employee', '', false), set_config('test.manager', 'false', false)", [user])
      const candidates = await db.query<{ employee_id: string; assignment_status: string; total_count: bigint }>(`select employee_id, assignment_status, total_count from public.search_performance_review_candidates($1, requested_administration => $2)`, [group, admin])
      expect(candidates.rows).toHaveLength(3)
      expect(candidates.rows.find(row => row.employee_id === employee)?.assignment_status).toBe('READY')
      expect(Number(candidates.rows[0]?.total_count)).toBe(3)
      const reviewerCandidates = await db.query<{ employee_id: string; assignment_status: string }>(`select employee_id, assignment_status from public.search_performance_review_candidates($1, requested_employee => $2)`, [group, employee])
      expect(reviewerCandidates.rows.map(row => row.employee_id).sort()).toEqual([reviewer, nextReviewer].sort())
      expect(reviewerCandidates.rows.every(row => row.assignment_status === 'READY')).toBe(true)
      const dueDossier = await db.query<{ id: string; process_instance_id: string | null }>(`select * from public.add_performance_review_dossier($1, $2, $3, $4)`, [dueRound, employee, reviewer, admin])
      const futureDossier = await db.query<{ id: string; process_instance_id: string | null }>(`select * from public.add_performance_review_dossier($1, $2, $3, $4)`, [futureRound, secondEmployee, reviewer, admin])
      expect(dueDossier.rows[0]?.process_instance_id).toBeNull()
      expect(futureDossier.rows[0]?.process_instance_id).toBeNull()
      await db.exec('reset role')
      await db.exec('set role service_role')
      await db.query("select set_config('test.jwt_role', 'authenticated', false), set_config('test.auth_user', '', false)")
      await expect(db.query('select public.run_due_performance_review_activations()')).rejects.toThrow(/PERFORMANCE_SCHEDULER_FORBIDDEN/)
      await db.query("select set_config('test.jwt_role', 'service_role', false)")
      const dueActivations = await db.query<{ run_due_performance_review_activations: number }>('select public.run_due_performance_review_activations()')
      expect(dueActivations.rows[0]?.run_due_performance_review_activations).toBe(1)
      const repeatedActivations = await db.query<{ run_due_performance_review_activations: number }>('select public.run_due_performance_review_activations()')
      expect(repeatedActivations.rows[0]?.run_due_performance_review_activations).toBe(0)
      await db.exec('reset role')
      const activatedDossier = await db.query<{ process_instance_id: string | null }>('select process_instance_id from public.performance_review_dossiers where id = $1', [dueDossier.rows[0]?.id])
      const notDueDossier = await db.query<{ process_instance_id: string | null; status: string }>('select dossier.process_instance_id, round.status from public.performance_review_dossiers dossier join public.performance_review_rounds round on round.id = dossier.round_id where dossier.id = $1', [futureDossier.rows[0]?.id])
      expect(activatedDossier.rows[0]?.process_instance_id).not.toBeNull()
      expect(notDueDossier.rows[0]).toEqual({ process_instance_id: null, status: 'SCHEDULED' })
      const systemActivationAudit = await db.query<{ actor_user_id: string | null; actor_kind: string }>("select actor_user_id, actor_kind from public.performance_review_audit_events where round_id = $1 and action = 'ROUND_ACTIVATED'", [dueRound])
      expect(systemActivationAudit.rows).toEqual([{ actor_user_id: null, actor_kind: 'SYSTEM' }])
      await db.exec('set role authenticated')
      await db.query("select set_config('test.jwt_role', 'authenticated', false), set_config('test.auth_user', $1, false), set_config('test.hr', 'true', false)", [user])
      const created = await db.query<{ id: string; version: number; round_type: string; additional_reviewer_enabled: boolean }>(`select * from public.create_performance_review_round($1, 'Jaarlijks gesprek 2026', 'Terugkijken en vooruitkijken', '2026-01-01', '2026-12-31', '2000-01-01', '2026-12-31', null::jsonb, 'round-create-001', 'ANNUAL')`, [group])
      const rpcRound = created.rows[0]
      expect(rpcRound?.id).toBeTruthy()
      expect(rpcRound).toMatchObject({ round_type: 'ANNUAL', additional_reviewer_enabled: false })
      const futureDraft = await db.query<{ id: string; status: string; version: number }>(`select * from public.create_performance_review_round($1, 'Voorbereide ronde 2099', 'Concept blijft ongepubliceerd', '2099-01-01', '2099-12-31', '2099-01-01', '2099-12-31', null::jsonb, 'round-future-draft-001', 'DEVELOPMENT')`, [group])
      expect(futureDraft.rows[0]?.status).toBe('DRAFT')
      const updatedDraft = await db.query<{ id: string; status: string; version: number; title: string }>(`select * from public.update_performance_review_round($1, 'Voorbereide ronde bijgewerkt 2099', 'Concept bijgewerkt en klaar om deelnemers toe te voegen', 'DEVELOPMENT', '2099-01-01', '2099-12-31', '2099-02-01', '2099-02-20', null::jsonb, $2)`, [futureDraft.rows[0]?.id, futureDraft.rows[0]?.version])
      expect(updatedDraft.rows[0]).toMatchObject({ id: futureDraft.rows[0]?.id, status: 'DRAFT', version: 2, title: 'Voorbereide ronde bijgewerkt 2099' })
      await expect(db.query(`select * from public.update_performance_review_round($1, 'Verouderde wijziging', 'Deze update moet worden geweigerd', 'DEVELOPMENT', '2099-01-01', '2099-12-31', '2099-02-01', '2099-02-20', null::jsonb, $2)`, [futureDraft.rows[0]?.id, futureDraft.rows[0]?.version])).rejects.toThrow(/PERFORMANCE_VERSION_OR_PHASE_CONFLICT/)
      const prepared = await db.query<{ id: string; version: number }>(`select * from public.add_performance_review_dossier($1, $2, $3, $4)`, [rpcRound?.id, employee, reviewer, admin])
      const retriedCreate = await db.query<{ id: string; version: number }>(`select * from public.create_performance_review_round($1, 'Jaarlijks gesprek 2026', 'Terugkijken en vooruitkijken', '2026-01-01', '2026-12-31', '2000-01-01', '2026-12-31', null::jsonb, 'round-create-001', 'ANNUAL')`, [group])
      expect(retriedCreate.rows[0]?.id).toBe(rpcRound?.id)
      await expect(db.query(`select * from public.create_performance_review_round($1, 'Andere inhoud', 'Terugkijken en vooruitkijken', '2026-01-01', '2026-12-31', '2000-01-01', '2026-12-31', null::jsonb, 'round-create-001', 'ANNUAL')`, [group])).rejects.toThrow(/PERFORMANCE_IDEMPOTENCY_KEY_REUSED/)
      const published = await db.query<{ id: string; version: number }>(`select * from public.publish_performance_review_round($1, $2)`, [rpcRound?.id, rpcRound?.version])
      const activeRound = published.rows[0]
      const rpcDossier = prepared.rows[0]
      expect(rpcDossier?.id).toBeTruthy()
      const pmuxProcess = await db.query<{ process_instance_id: string }>('select process_instance_id from public.performance_review_dossiers where id = $1', [rpcDossier?.id])
      expect(pmuxProcess.rows[0]?.process_instance_id).toBeTruthy()
      const pmuxDeadline = await db.query<{ deadline_at: string }>('select deadline_at from public.process_step_instances where process_instance_id = $1', [pmuxProcess.rows[0]?.process_instance_id])
      expect(new Date(pmuxDeadline.rows[0]?.deadline_at ?? '').toISOString()).toBe('2026-12-31T23:00:00.000Z')
      const draftAdded = await db.query<{ id: string; version: number }>(`select * from public.add_performance_review_dossier($1, $2, $3, $4)`, [activeRound?.id, secondEmployee, reviewer, admin])
      await db.query("select set_config('test.hr', 'false', false), set_config('test.employee', $1, false)", [employee])
      const selfSaved = await db.query<{ version: number }>(`select * from public.save_performance_review_self($1, 'Mijn reflectie over het jaar', $2, true)`, [rpcDossier?.id, rpcDossier?.version])
      expect(selfSaved.rows[0]?.version).toBe(2)
      const managerStep = '00000000-0000-4000-8000-000000000021'
      const managerWorkItem = '00000000-0000-4000-8000-000000000022'
      await db.query("insert into public.process_step_instances (id, tenant_id, hr_group_id, process_instance_id, process_version_id, step_key, status) values ($1, $2, $3, $4, $5, 'manager-response', 'PENDING')", [managerStep, tenant, group, pmuxProcess.rows[0]?.process_instance_id, processVersion])
      await db.query("update public.process_step_instances set status = 'ACTIVE', activated_at = now() where id = $1", [managerStep])
      expect(new Date((await db.query<{ deadline_at: string }>('select deadline_at from public.process_step_instances where id = $1', [managerStep])).rows[0]?.deadline_at ?? '').toISOString()).toBe('2026-12-31T23:00:00.000Z')
      await db.query("insert into public.process_work_items (id, tenant_id, hr_group_id, process_instance_id, step_instance_id, step_key, participant_key, status) values ($1, $2, $3, $4, $5, 'manager-response', 'manager', 'OPEN')", [managerWorkItem, tenant, group, pmuxProcess.rows[0]?.process_instance_id, managerStep])
      await db.exec('reset role')
      await db.query('update public.employee_organizations set direct_manager_id = $1 where employee_id = $2 and tenant_id = $3', [nextReviewer, employee, tenant])
      await db.exec('set role authenticated')
      await db.query("select set_config('test.hr', 'true', false)")
      const reassigned = await db.query<{ reviewer_employee_id: string; version: number }>('select * from public.reassign_performance_review_reviewer($1, $2, $3)', [rpcDossier?.id, nextReviewer, selfSaved.rows[0]?.version])
      expect(reassigned.rows[0]?.reviewer_employee_id).toBe(nextReviewer)
      expect(reassigned.rows[0]?.version).toBe(3)
      const reassignedWorkItem = await db.query<{ assignee_employee_id: string }>('select assignee_employee_id from public.process_work_items where id = $1', [managerWorkItem])
      expect(reassignedWorkItem.rows[0]?.assignee_employee_id).toBe(nextReviewer)
      await db.query("select set_config('test.auth_user', $1, false), set_config('test.employee', $2, false), set_config('test.manager', 'true', false), set_config('test.hr', 'false', false)", [nextReviewerUser, nextReviewer])
      const attachmentKey = 'perf-attachment-001'
      const attachmentArgs = [rpcDossier?.id, `${tenant}/${rpcDossier?.id}/00000000-0000-4000-8000-000000000026/Gespreksafspraken.pdf`, 'Gespreksafspraken.pdf', 'application/pdf', 42, 'a'.repeat(64), attachmentKey]
      const attachmentCreated = await db.query<{ id: string }>('select * from public.add_performance_review_attachment($1, $2, $3, $4, $5, $6, $7)', attachmentArgs)
      const attachmentRetried = await db.query<{ id: string }>('select * from public.add_performance_review_attachment($1, $2, $3, $4, $5, $6, $7)', attachmentArgs)
      expect(attachmentRetried.rows[0]?.id).toBe(attachmentCreated.rows[0]?.id)
      await expect(db.query('select * from public.add_performance_review_attachment($1, $2, $3, $4, $5, $6, $7)', [rpcDossier?.id, `${tenant}/${rpcDossier?.id}/00000000-0000-4000-8000-000000000026/Changed.pdf`, 'Changed.pdf', 'application/pdf', 42, 'a'.repeat(64), attachmentKey])).rejects.toThrow(/PERFORMANCE_IDEMPOTENCY_KEY_REUSED/)
      const deletedAttachment = await db.query<{ id: string }>('select * from public.delete_performance_review_attachment($1)', [attachmentCreated.rows[0]?.id])
      expect(deletedAttachment.rows[0]?.id).toBe(attachmentCreated.rows[0]?.id)
      const managerSaved = await db.query<{ version: number }>(`select * from public.save_performance_review_manager($1, 'De managerreactie is positief en concreet.', null, null, null, $2, true)`, [rpcDossier?.id, reassigned.rows[0]?.version])
      expect(managerSaved.rows[0]?.version).toBe(4)
      await db.query(`select * from public.save_performance_review_private_note($1, 'Interne opvolging: bespreek ontwikkelpad in Q1.')`, [rpcDossier?.id])
      const acknowledgementStep = '00000000-0000-4000-8000-000000000023'
      await db.query("insert into public.process_step_instances (id, tenant_id, hr_group_id, process_instance_id, process_version_id, step_key, status) values ($1, $2, $3, $4, $5, 'employee-acknowledgement', 'PENDING')", [acknowledgementStep, tenant, group, pmuxProcess.rows[0]?.process_instance_id, processVersion])
      await db.query("update public.process_step_instances set status = 'ACTIVE', activated_at = now() where id = $1", [acknowledgementStep])
      expect(new Date((await db.query<{ deadline_at: string }>('select deadline_at from public.process_step_instances where id = $1', [acknowledgementStep])).rows[0]?.deadline_at ?? '').toISOString()).toBe('2026-12-31T23:00:00.000Z')
      await db.query("insert into public.process_work_items (tenant_id, hr_group_id, process_instance_id, step_instance_id, step_key, participant_key, status) values ($1, $2, $3, $4, 'employee-acknowledgement', 'employee', 'OPEN')", [tenant, group, pmuxProcess.rows[0]?.process_instance_id, acknowledgementStep])
      await db.query("select set_config('test.employee', $1, false), set_config('test.manager', 'false', false), set_config('test.hr', 'false', false)", [employee])
      const scopeProbe = await db.query<{ current_employee: string | null; can_private: boolean }>(`select internal_security.current_employee_id($1, $2) as current_employee, internal_security.performance_review_can_private($3, $4, $5, $6) as can_private`, [tenant, group, tenant, group, employee, nextReviewer])
      expect(scopeProbe.rows[0]?.current_employee).toBe(employee)
      expect(scopeProbe.rows[0]?.can_private).toBe(false)
      const employeePrivate = await db.query('select * from public.performance_review_private_notes')
      expect(employeePrivate.rows).toHaveLength(0)
      const employeeSubmission = await db.query('select kind, body from public.performance_review_submissions where dossier_id = $1 order by kind', [rpcDossier?.id])
      expect(employeeSubmission.rows).toHaveLength(2)
      await db.query("select set_config('test.employee', $1, false), set_config('test.manager', 'false', false), set_config('test.hr', 'false', false)", [secondEmployee])
      const draftSaved = await db.query<{ version: number }>(`select * from public.save_performance_review_self($1, 'Concept reflectie', $2, false)`, [draftAdded.rows[0]?.id, draftAdded.rows[0]?.version])
      const submittedDraft = await db.query<{ version: number }>(`select * from public.save_performance_review_self($1, 'Definitieve reflectie', $2, true)`, [draftAdded.rows[0]?.id, draftSaved.rows[0]?.version])
      expect(submittedDraft.rows[0]?.version).toBe(3)
      const submittedRow = await db.query<{ submitted_at: string | null }>(`select submitted_at from public.performance_review_submissions where dossier_id = $1 and kind = 'SELF'`, [draftAdded.rows[0]?.id])
      expect(submittedRow.rows[0]?.submitted_at).not.toBeNull()
      await db.query("select set_config('test.employee', $1, false), set_config('test.manager', 'false', false), set_config('test.hr', 'true', false)", [employee])
      const acknowledged = await db.query<{ version: number }>(`select * from public.acknowledge_performance_review($1, 'AGREE', null, $2)`, [rpcDossier?.id, managerSaved.rows[0]?.version])
      expect(acknowledged.rows[0]?.version).toBe(5)
      expect((await db.query<{ decision: string }>('select decision from public.performance_review_acknowledgements where dossier_id = $1', [rpcDossier?.id])).rows[0]?.decision).toBe('AGREE')
      const pmuxActions = await db.query<{ count: string }>("select count(*)::text as count from public.test_pmux_actions where idempotency_key like 'performance-review-%'")
      expect(Number(pmuxActions.rows[0]?.count)).toBe(5)
      expect((await db.query<{ count: string }>("select count(distinct idempotency_key)::text as count from public.test_pmux_actions where idempotency_key like 'performance-review-%'")).rows[0]?.count).toBe('5')
      const pmuxClaims = await db.query<{ count: string; unique_items: string }>("select count(*)::text as count, count(distinct work_item_id)::text as unique_items from public.test_pmux_actions where action = 'CLAIM' and idempotency_key like 'claim:%'")
      expect(pmuxClaims.rows[0]?.count).toBe('5')
      expect(pmuxClaims.rows[0]?.unique_items).toBe('5')
      await db.query("select set_config('test.employee', $1, false), set_config('test.hr', 'false', false), set_config('test.manager', 'false', false)", [employee])
      await expect(db.query(`select * from public.create_performance_review_round($1, 'Onbevoegd', 'Geen', '2026-01-01', '2026-12-31', '2000-01-01', null, null::jsonb)`, [group])).rejects.toThrow(/PERFORMANCE_FORBIDDEN/)
      await db.query("select set_config('test.hr', 'true', false)")
      await expect(db.query(`select * from public.add_performance_review_dossier($1, $2, $3, $4)`, [activeRound?.id, otherEmployee, reviewer, admin])).rejects.toThrow(/PERFORMANCE_SCOPE_INVALID/)
      await db.query("select set_config('test.hr', 'false', false)")
      await expect(db.query(`select * from public.close_performance_review_round($1, 'Onbevoegd sluiten', $2)`, [activeRound?.id, activeRound?.version])).rejects.toThrow(/PERFORMANCE_FORBIDDEN/)
      await db.query("select set_config('test.hr', 'true', false)")
      const closed = await db.query<{ version: number }>(`select * from public.close_performance_review_round($1, 'Testsluiting na akkoord', $2)`, [activeRound?.id, activeRound?.version])
      expect(closed.rows[0]?.version).toBe(3)
      await expect(db.query(`select * from public.close_performance_review_round($1, 'Dubbele sluiting', $2)`, [activeRound?.id, activeRound?.version])).rejects.toThrow(/PERFORMANCE_ROUND_CONFLICT/)
      const cancelCandidate = await db.query<{ id: string; version: number }>(`select * from public.create_performance_review_round($1, 'Annuleren 2026', 'Administratieve test', '2026-01-01', '2026-12-31', '2000-01-01', null, null::jsonb)`, [group])
      const cancelPublished = await db.query<{ id: string; version: number }>(`select * from public.publish_performance_review_round($1, $2)`, [cancelCandidate.rows[0]?.id, cancelCandidate.rows[0]?.version])
      const cancelled = await db.query<{ version: number }>(`select * from public.cancel_performance_review_round($1, 'Test annulering', $2)`, [cancelPublished.rows[0]?.id, cancelPublished.rows[0]?.version])
      expect(cancelled.rows[0]?.version).toBe(3)

      const v2RoundResult = await db.query<{ id: string; version: number; additional_reviewer_enabled: boolean }>(`select * from public.create_performance_review_round_v2(
        $1, 'V2-gespreksronde', 'Gecontroleerde vijfstappenflow.', 'DEVELOPMENT', '2026-01-01', '2026-12-31',
        '2000-01-01', '2026-12-31', null::jsonb, true, 'perf-v2-round-001')`, [group])
      const v2Round = v2RoundResult.rows[0]
      expect(v2Round).toMatchObject({ additional_reviewer_enabled: true, version: 1 })
      await expect(db.query(`select * from public.add_performance_review_dossier_v2($1, $2, $3, $4, $5, 'perf-v2-wrong-administration-001')`, [v2Round?.id, employee, v2Reviewer, nextReviewer, wrongAdministration])).rejects.toThrow(/PERFORMANCE_ADMINISTRATION_INVALID/)
      await expect(db.query(`select * from public.add_performance_review_dossier_v2($1, $2, $3, $4, $5, 'perf-v2-wrong-hr-group-001')`, [v2Round?.id, otherEmployee, v2Reviewer, nextReviewer, v2Administration])).rejects.toThrow(/PERFORMANCE_SCOPE_INVALID/)
      await expect(db.query(`select * from public.add_performance_review_dossier_v2($1, $2, $3, $4, $5, 'perf-v2-foreign-tenant-001')`, [v2Round?.id, foreignEmployee, v2Reviewer, nextReviewer, v2Administration])).rejects.toThrow(/PERFORMANCE_SCOPE_INVALID/)
      const v2DossierResult = await db.query<{ id: string; version: number; phase: string }>(`select * from public.add_performance_review_dossier_v2(
        $1, $2, $3, $4, $5, 'perf-v2-dossier-001')`, [v2Round?.id, employee, v2Reviewer, nextReviewer, v2Administration])
      const v2Dossier = v2DossierResult.rows[0]
      expect(v2Dossier).toMatchObject({ phase: 'WAITING_EMPLOYEE', version: 1 })
      const v2Published = await db.query<{ id: string; version: number; status: string }>(
        'select * from public.publish_performance_review_round($1, $2)', [v2Round?.id, v2Round?.version])
      expect(v2Published.rows[0]?.status).toBe('ACTIVE')
      const v2Process = await db.query<{ process_instance_id: string; process_version_id: string }>(`select dossier.process_instance_id, instance.process_version_id
        from public.performance_review_dossiers dossier join public.process_instances instance on instance.id = dossier.process_instance_id
        where dossier.id = $1`, [v2Dossier?.id])
      const v2ProcessId = v2Process.rows[0]?.process_instance_id
      expect(v2ProcessId).toBeTruthy()
      await db.exec('reset role')
      const v2RuntimeDefinition = await db.query<{ key: string; idempotency_key: string; additional_reviewer_workflow: boolean }>(`select definition.key, instance.idempotency_key, dossier.additional_reviewer_workflow
        from public.performance_review_dossiers dossier join public.process_instances instance on instance.id = dossier.process_instance_id
        join public.process_definitions definition on definition.id = instance.process_definition_id where dossier.id = $1`, [v2Dossier?.id])
      expect(v2RuntimeDefinition.rows[0]).toMatchObject({ key: 'performance-review-additional-v2', additional_reviewer_workflow: true })
      await db.exec('set role authenticated')

      await db.query("select set_config('test.auth_user', $1, false), set_config('test.employee', $2, false), set_config('test.hr', 'false', false), set_config('test.manager', 'false', false)", [user, employee])
      const v2SelfWorkItem = (await db.query<{ id: string }>("select id from public.process_work_items where process_instance_id = $1 and step_key = 'self-reflection'", [v2ProcessId])).rows[0]?.id
      expect(v2SelfWorkItem).toBeTruthy()
      await db.exec('reset role')
      await expect(db.query("select internal_security.prepare_process_form_action($1, 'SUBMIT')", [v2SelfWorkItem])).rejects.toThrow(/PERFORMANCE_DOMAIN_ACTION_REQUIRED/)
      await db.exec('set role authenticated')
      const v2SelfSaved = await db.query<{ version: number; phase: string }>(`select * from public.save_performance_review_self($1, 'Ik heb mijn doelen en resultaten beschreven.', $2, true)`, [v2Dossier?.id, v2Dossier?.version])
      expect(v2SelfSaved.rows[0]).toMatchObject({ version: 2, phase: 'WAITING_ADDITIONAL_REVIEWER' })
      const additionalStep = '00000000-0000-4000-8000-000000000071'
      const additionalWorkItem = '00000000-0000-4000-8000-000000000072'
      await db.query("insert into public.process_step_instances (id, tenant_id, hr_group_id, process_instance_id, process_version_id, step_key, status, activated_at) values ($1, $2, $3, $4, $5, 'additional-reviewer-feedback', 'ACTIVE', now())", [additionalStep, tenant, group, v2ProcessId, v2Process.rows[0]?.process_version_id])
      await db.query("insert into public.process_work_items (id, tenant_id, hr_group_id, process_instance_id, step_instance_id, step_key, participant_key, status, assignee_employee_id) values ($1, $2, $3, $4, $5, 'additional-reviewer-feedback', 'additional-reviewer', 'OPEN', $6)", [additionalWorkItem, tenant, group, v2ProcessId, additionalStep, nextReviewer])
      await db.query("select set_config('test.auth_user', $1, false), set_config('test.employee', $2, false), set_config('test.hr', 'false', false)", [nextReviewerUser, nextReviewer])
      await db.query("select set_config('liquidhr.performance_review.domain_transition', 'on', true)")
      await expect(db.query('select public.perform_process_work_item_action($1, \'SUBMIT\', 1, 1, \'spoofed-domain-action\', null)', [additionalWorkItem])).rejects.toThrow(/PERFORMANCE_DOMAIN_ACTION_REQUIRED/)
      expect((await db.query('select kind, body from public.performance_review_submissions where dossier_id = $1 order by kind', [v2Dossier?.id])).rows).toEqual([
        { kind: 'SELF', body: 'Ik heb mijn doelen en resultaten beschreven.' },
      ])
      const v2AdditionalSaved = await db.query<{ version: number; phase: string }>(`select * from public.save_performance_review_additional_reviewer($1, 'De medewerker heeft zichtbaar bijgedragen aan het team.', $2, true)`, [v2Dossier?.id, v2SelfSaved.rows[0]?.version])
      expect(v2AdditionalSaved.rows[0]).toMatchObject({ version: 3, phase: 'WAITING_MANAGER' })
      const abSelfRead = await db.query<{ kind: string; body: string }>('select kind, body from public.performance_review_submissions where dossier_id = $1 order by kind', [v2Dossier?.id])
      expect(abSelfRead.rows.map((row) => row.kind)).toEqual(['ADDITIONAL_REVIEWER', 'SELF'])
      expect((await db.query('select * from public.performance_review_private_notes where dossier_id = $1', [v2Dossier?.id])).rows).toHaveLength(0)
      await expect(db.query(`select * from public.save_performance_review_private_note($1, 'AB mag dit niet opslaan.')`, [v2Dossier?.id])).rejects.toThrow(/PERFORMANCE_PRIVATE_FORBIDDEN/)
      await expect(db.query(`select * from public.save_performance_review_manager($1, 'AB mag geen GV-reactie indienen.', null, null, null, $2, true)`, [v2Dossier?.id, v2AdditionalSaved.rows[0]?.version])).rejects.toThrow(/PERFORMANCE_FORBIDDEN/)
      await db.query("select set_config('test.auth_user', $1, false), set_config('test.employee', $2, false), set_config('test.hr', 'true', false)", [user, employee])
      await db.query(`select * from public.save_performance_review_private_note($1, 'HR-only context voor de volledige beoordelaar.')`, [v2Dossier?.id])
      await db.query("select set_config('test.hr', 'false', false)")
      await db.query("select set_config('test.auth_user', $1, false), set_config('test.employee', $2, false), set_config('test.manager', 'false', false)", [v2ReviewerUser, v2Reviewer])
      const abDossiers = await db.query<{ id: string }>('select id from public.performance_review_dossiers where round_id = $1', [v2Round?.id])
      expect(abDossiers.rows.map((row) => row.id)).toEqual([v2Dossier?.id])
      const managerPrivateRead = await db.query('select * from public.performance_review_private_notes where dossier_id = $1', [v2Dossier?.id])
      expect(managerPrivateRead.rows).toHaveLength(0)
      await db.query("select set_config('test.auth_user', $1, false), set_config('test.employee', $2, false), set_config('test.hr', 'false', false)", [bulkEmployeeUser, secondEmployee])
      expect((await db.query('select id from public.performance_review_dossiers where id = $1', [v2Dossier?.id])).rows).toHaveLength(0)
      await db.query("select set_config('test.auth_user', $1, false), set_config('test.employee', $2, false), set_config('test.hr', 'false', false)", [user, employee])
      const hiddenUntilManagerSubmission = await db.query<{ kind: string }>("select kind from public.performance_review_submissions where dossier_id = $1 and kind = 'ADDITIONAL_REVIEWER'", [v2Dossier?.id])
      expect(hiddenUntilManagerSubmission.rows).toHaveLength(0)
      await db.query("select set_config('test.auth_user', $1, false), set_config('test.employee', $2, false), set_config('test.hr', 'false', false)", [v2ReviewerUser, v2Reviewer])
      const v2ManagerStep = '00000000-0000-4000-8000-000000000073'
      const v2ManagerWorkItem = '00000000-0000-4000-8000-000000000074'
      await db.query("insert into public.process_step_instances (id, tenant_id, hr_group_id, process_instance_id, process_version_id, step_key, status, activated_at) values ($1, $2, $3, $4, $5, 'manager-response', 'ACTIVE', now())", [v2ManagerStep, tenant, group, v2ProcessId, v2Process.rows[0]?.process_version_id])
      await db.query("insert into public.process_work_items (id, tenant_id, hr_group_id, process_instance_id, step_instance_id, step_key, participant_key, status, assignee_employee_id) values ($1, $2, $3, $4, $5, 'manager-response', 'reviewer', 'OPEN', $6)", [v2ManagerWorkItem, tenant, group, v2ProcessId, v2ManagerStep, v2Reviewer])
      const v2ManagerSaved = await db.query<{ version: number; phase: string }>(`select * from public.save_performance_review_manager($1, 'Ik heb de bijdrage besproken en de afspraken vastgelegd.', null, null, null, $2, true)`, [v2Dossier?.id, v2AdditionalSaved.rows[0]?.version])
      expect(v2ManagerSaved.rows[0]).toMatchObject({ version: 4, phase: 'WAITING_ACKNOWLEDGEMENT' })
      await db.exec('reset role')
      await expect(db.query(`update public.performance_review_submissions set body = 'Gewijzigd na definitieve indiening.' where dossier_id = $1 and kind = 'ADDITIONAL_REVIEWER'`, [v2Dossier?.id])).rejects.toThrow(/PERFORMANCE_SUBMISSION_IMMUTABLE/)
      await db.query(`insert into public.performance_review_attachments (tenant_id, dossier_id, uploaded_by, storage_key, original_filename, content_type, file_size, checksum_sha256)
        values ($1, $2, $3, $4, 'Intern.pdf', 'application/pdf', 32, repeat('a', 64))`, [tenant, v2Dossier?.id, user, `${tenant}/${v2Dossier?.id}/intern.pdf`])
      await db.query("insert into storage.objects (bucket_id, name) values ('performance-review-attachments', $1)", [`${tenant}/${v2Dossier?.id}/intern.pdf`])
      await db.exec('set role authenticated')
      await db.query("select set_config('test.auth_user', $1, false), set_config('test.employee', $2, false), set_config('test.hr', 'false', false)", [user, employee])
      expect((await db.query<{ kind: string }>('select kind from public.performance_review_submissions where dossier_id = $1 and kind = \'ADDITIONAL_REVIEWER\'', [v2Dossier?.id])).rows).toHaveLength(1)
      const v2AcknowledgementStep = '00000000-0000-4000-8000-000000000075'
      const v2AcknowledgementWorkItem = '00000000-0000-4000-8000-000000000076'
      await db.query("insert into public.process_step_instances (id, tenant_id, hr_group_id, process_instance_id, process_version_id, step_key, status, activated_at) values ($1, $2, $3, $4, $5, 'employee-acknowledgement', 'ACTIVE', now())", [v2AcknowledgementStep, tenant, group, v2ProcessId, v2Process.rows[0]?.process_version_id])
      await db.query("insert into public.process_work_items (id, tenant_id, hr_group_id, process_instance_id, step_instance_id, step_key, participant_key, status, assignee_employee_id) values ($1, $2, $3, $4, $5, 'employee-acknowledgement', 'employee', 'OPEN', $6)", [v2AcknowledgementWorkItem, tenant, group, v2ProcessId, v2AcknowledgementStep, employee])
      const v2Acknowledged = await db.query<{ version: number; phase: string }>(`select * from public.acknowledge_performance_review($1, 'DISAGREE', 'Ik herken mij niet in deze conclusie.', $2)`, [v2Dossier?.id, v2ManagerSaved.rows[0]?.version])
      expect(v2Acknowledged.rows[0]).toMatchObject({ version: 5, phase: 'WAITING_REVIEWER_CLOSE' })
      const employeeVisibleContribution = await db.query<{ body: string }>('select body from public.performance_review_submissions where dossier_id = $1 and kind = \'ADDITIONAL_REVIEWER\'', [v2Dossier?.id])
      expect(employeeVisibleContribution.rows).toEqual([{ body: 'De medewerker heeft zichtbaar bijgedragen aan het team.' }])
      const closeStep = '00000000-0000-4000-8000-000000000077'
      const closeWorkItem = '00000000-0000-4000-8000-000000000078'
      await db.query("insert into public.process_step_instances (id, tenant_id, hr_group_id, process_instance_id, process_version_id, step_key, status, activated_at) values ($1, $2, $3, $4, $5, 'manager-close', 'ACTIVE', now())", [closeStep, tenant, group, v2ProcessId, v2Process.rows[0]?.process_version_id])
      await db.query("insert into public.process_work_items (id, tenant_id, hr_group_id, process_instance_id, step_instance_id, step_key, participant_key, status, assignee_employee_id) values ($1, $2, $3, $4, $5, 'manager-close', 'reviewer', 'OPEN', $6)", [closeWorkItem, tenant, group, v2ProcessId, closeStep, v2Reviewer])
      await expect(db.query('select * from public.close_performance_review_dossier_v2($1, $2)', [v2Dossier?.id, v2Acknowledged.rows[0]?.version])).rejects.toThrow(/PERFORMANCE_FORBIDDEN/)
      await db.query("select set_config('test.auth_user', $1, false), set_config('test.employee', $2, false), set_config('test.hr', 'true', false)", [user, employee])
      await expect(db.query('select * from public.close_performance_review_dossier_v2($1, $2)', [v2Dossier?.id, v2Acknowledged.rows[0]?.version])).rejects.toThrow(/PERFORMANCE_FORBIDDEN/)
      await db.query("select set_config('test.hr', 'false', false), set_config('test.auth_user', $1, false), set_config('test.employee', $2, false)", [v2ReviewerUser, v2Reviewer])
      const v2Closed = await db.query<{ version: number; phase: string }>('select * from public.close_performance_review_dossier_v2($1, $2)', [v2Dossier?.id, v2Acknowledged.rows[0]?.version])
      expect(v2Closed.rows[0]).toMatchObject({ version: 6, phase: 'COMPLETED_DISAGREED' })
      expect((await db.query('select * from public.performance_review_closures where dossier_id = $1', [v2Dossier?.id])).rows).toHaveLength(1)

      await db.query("select set_config('test.auth_user', $1, false), set_config('test.employee', $2, false), set_config('test.hr', 'true', false)", [user, employee])
      const bulkDossierResult = await db.query<{ id: string; version: number }>(`select * from public.add_performance_review_dossier_v2($1, $2, $3, $4, $5, 'perf-v2-bulk-001')`, [v2Round?.id, secondEmployee, v2Reviewer, nextReviewer, v2Administration])
      const bulkDossierId = bulkDossierResult.rows[0]?.id
      const missingAdditionalResult = await db.query<{ id: string; version: number }>(`select * from public.add_performance_review_dossier_v2($1, $2, $3, null, $4, 'perf-v2-no-ab-001')`, [v2Round?.id, reviewer, v2Reviewer, v2Administration])
      const allPreview = await db.query<{ preview: { total: number; eligible: number; blocked: number; previewHash: string; items: Array<{ dossierId: string; blockReason: string | null }> } }>(`select public.preview_performance_review_role_flip($1, 'ALL', null::uuid[]) as preview`, [v2Round?.id])
      const allPreviewValue = allPreview.rows[0]?.preview as unknown as { total: number; eligible: number; blocked: number; previewHash: string; items: Array<{ dossierId: string; blockReason: string | null }> }
      expect(allPreviewValue).toMatchObject({ total: 3, eligible: 1, blocked: 2 })
      expect((await db.query<{ version: number }>('select version from public.performance_review_dossiers where id = $1', [bulkDossierId])).rows[0]?.version).toBe(1)
      const selectedPreview = await db.query<{ preview: { total: number; blocked: number } }>(`select public.preview_performance_review_role_flip($1, 'FILTERED', array[$2::uuid, $3::uuid]) as preview`, [v2Round?.id, bulkDossierId, missingAdditionalResult.rows[0]?.id])
      expect(selectedPreview.rows[0]?.preview).toMatchObject({ total: 2, blocked: 1 })
      const bulkIds = allPreviewValue.items.map((item) => item.dossierId)
      const bulkApply = await db.query<{ result: { changed: number; blocked: number } }>(`select public.apply_performance_review_role_flip($1, $2, $3, 'Goedgekeurde individuele rolomwisseling', false, 'perf-v2-bulk-command-001') as result`, [v2Round?.id, bulkIds, allPreviewValue.previewHash])
      expect(bulkApply.rows[0]?.result).toMatchObject({ changed: 1, blocked: 2 })
      const bulkVersion = await db.query<{ reviewer_employee_id: string; additional_reviewer_employee_id: string; version: number }>(`select reviewer_employee_id, additional_reviewer_employee_id, version from public.performance_review_dossiers where id = $1`, [bulkDossierId])
      expect(bulkVersion.rows[0]).toMatchObject({ reviewer_employee_id: nextReviewer, additional_reviewer_employee_id: v2Reviewer, version: 2 })
      const bulkRetry = await db.query<{ result: { changed: number; blocked: number } }>(`select public.apply_performance_review_role_flip($1, $2, $3, 'Goedgekeurde individuele rolomwisseling', false, 'perf-v2-bulk-command-001') as result`, [v2Round?.id, bulkIds, allPreviewValue.previewHash])
      expect(bulkRetry.rows[0]?.result).toEqual(bulkApply.rows[0]?.result)
      await expect(db.query(`select public.apply_performance_review_role_flip($1, $2, $3, 'Verouderde preview', false, 'perf-v2-stale-command-001')`, [v2Round?.id, bulkIds, allPreviewValue.previewHash])).rejects.toThrow(/PERFORMANCE_PREVIEW_STALE/)
      await db.query("select set_config('test.hr', 'false', false), set_config('test.auth_user', $1, false), set_config('test.employee', $2, false)", [bulkEmployeeUser, secondEmployee])
      await expect(db.query(`select public.preview_performance_review_role_flip($1, 'ALL', null::uuid[])`, [v2Round?.id])).rejects.toThrow(/PERFORMANCE_FORBIDDEN/)
      await db.query("select set_config('test.hr', 'true', false), set_config('test.auth_user', $1, false), set_config('test.employee', $2, false)", [user, employee])
      const individualFlip = await db.query<{ reviewer_employee_id: string; additional_reviewer_employee_id: string; version: number }>(`select * from public.configure_performance_review_reviewers($1, $2, $3, $4, 'Individuele rolomwisseling via HR Admin.', false)`, [bulkDossierId, v2Reviewer, nextReviewer, bulkVersion.rows[0]?.version])
      expect(individualFlip.rows[0]).toMatchObject({ reviewer_employee_id: v2Reviewer, additional_reviewer_employee_id: nextReviewer, version: 3 })
      const bulkProcess = await db.query<{ process_instance_id: string; process_version_id: string }>('select process_instance_id, (select process_version_id from public.process_instances instance where instance.id = dossier.process_instance_id) as process_version_id from public.performance_review_dossiers dossier where dossier.id = $1', [bulkDossierId])
      await db.query("select set_config('test.hr', 'false', false), set_config('test.auth_user', $1, false), set_config('test.employee', $2, false)", [bulkEmployeeUser, secondEmployee])
      const bulkSelfSaved = await db.query<{ version: number; phase: string }>(`select * from public.save_performance_review_self($1, 'Mijn bijdrage aan deze ronde.', $2, true)`, [bulkDossierId, individualFlip.rows[0]?.version])
      expect(bulkSelfSaved.rows[0]).toMatchObject({ version: 4, phase: 'WAITING_ADDITIONAL_REVIEWER' })
      const bulkAbStep = '00000000-0000-4000-8000-000000000079'
      const bulkAbWorkItem = '00000000-0000-4000-8000-000000000080'
      await db.query("insert into public.process_step_instances (id, tenant_id, hr_group_id, process_instance_id, process_version_id, step_key, status, activated_at) values ($1, $2, $3, $4, $5, 'additional-reviewer-feedback', 'ACTIVE', now())", [bulkAbStep, tenant, group, bulkProcess.rows[0]?.process_instance_id, bulkProcess.rows[0]?.process_version_id])
      await db.query("insert into public.process_work_items (id, tenant_id, hr_group_id, process_instance_id, step_instance_id, step_key, participant_key, status, assignee_employee_id) values ($1, $2, $3, $4, $5, 'additional-reviewer-feedback', 'additional-reviewer', 'OPEN', $6)", [bulkAbWorkItem, tenant, group, bulkProcess.rows[0]?.process_instance_id, bulkAbStep, nextReviewer])
      await db.query("select set_config('test.auth_user', $1, false), set_config('test.employee', $2, false)", [nextReviewerUser, nextReviewer])
      const abDraft = await db.query<{ version: number; phase: string }>(`select * from public.save_performance_review_additional_reviewer($1, 'Conceptbijdrage blijft alleen in archief na rolwisseling.', $2, false)`, [bulkDossierId, bulkSelfSaved.rows[0]?.version])
      expect(abDraft.rows[0]).toMatchObject({ version: 5, phase: 'WAITING_ADDITIONAL_REVIEWER' })
      await db.query("select set_config('test.auth_user', $1, false), set_config('test.employee', $2, false), set_config('test.hr', 'true', false)", [user, employee])
      const draftPreviewResult = await db.query<{ preview: { total: number; eligible: number; draftCount: number; previewHash: string; items: Array<{ dossierId: string }> } }>(`select public.preview_performance_review_role_flip($1, 'SELECTED', array[$2::uuid]) as preview`, [v2Round?.id, bulkDossierId])
      const draftPreview = draftPreviewResult.rows[0]?.preview
      expect(draftPreview).toMatchObject({ total: 1, eligible: 1, draftCount: 1 })
      await expect(db.query(`select public.apply_performance_review_role_flip($1, array[$2::uuid], $3, 'Concepten niet stil verplaatsen', false, 'perf-v2-draft-block-001')`, [v2Round?.id, bulkDossierId, draftPreview?.previewHash])).rejects.toThrow(/PERFORMANCE_DRAFTS_REQUIRE_CONFIRMATION/)
      const preservedDraftFlip = await db.query<{ result: { changed: number; draftsPreserved: boolean } }>(`select public.apply_performance_review_role_flip($1, array[$2::uuid], $3, 'Concept als onveranderbaar archief bewaren', true, 'perf-v2-draft-preserve-001') as result`, [v2Round?.id, bulkDossierId, draftPreview?.previewHash])
      expect(preservedDraftFlip.rows[0]?.result).toMatchObject({ changed: 1, draftsPreserved: true })
      const archivedDraft = await db.query<{ body: string; reason: string }>('select body, reason from public.performance_review_draft_archives where dossier_id = $1 and kind = \'ADDITIONAL_REVIEWER\'', [bulkDossierId])
      expect(archivedDraft.rows).toEqual([{ body: 'Conceptbijdrage blijft alleen in archief na rolwisseling.', reason: 'Concept als onveranderbaar archief bewaren' }])
      const taskState = await db.query<{ open_items: string; assignee_employee_id: string | null }>(`select count(*) filter (where item.status in ('OPEN','CLAIMED'))::text as open_items,
        min(item.assignee_employee_id::text)::uuid as assignee_employee_id from public.process_work_items item where item.process_instance_id = $1`, [bulkProcess.rows[0]?.process_instance_id])
      expect(taskState.rows[0]).toMatchObject({ open_items: '1', assignee_employee_id: v2Reviewer })
      const replacedAb = await db.query<{ reviewer_employee_id: string; additional_reviewer_employee_id: string; version: number }>(`select * from public.configure_performance_review_reviewers($1, $2, $3, $4, 'Vervang AB met onderbouwde dossierkeuze.', false)`, [bulkDossierId, nextReviewer, employee, 6])
      expect(replacedAb.rows[0]).toMatchObject({ reviewer_employee_id: nextReviewer, additional_reviewer_employee_id: employee, version: 7 })
      await db.query("select set_config('test.auth_user', $1, false), set_config('test.employee', $2, false), set_config('test.hr', 'true', false)", [user, employee])
      const releasedAb = await db.query<{ version: number; phase: string; additional_reviewer_employee_id: string | null; additional_reviewer_released_at: string | null }>(`select * from public.release_performance_review_additional_reviewer($1, $2, 'AB gemotiveerd vrijgegeven nadat de bijdrage niet nodig bleek.')`, [bulkDossierId, replacedAb.rows[0]?.version])
      expect(releasedAb.rows[0]).toMatchObject({ version: 8, phase: 'WAITING_MANAGER', additional_reviewer_employee_id: null })
      expect(releasedAb.rows[0]?.additional_reviewer_released_at).toBeTruthy()
      await db.exec('reset role')
      const releaseAudit = await db.query<{ action: string; details: { previousAdditionalReviewerEmployeeId: string; archivedDraftCount: number } }>(`select action, details from public.performance_review_audit_events where dossier_id = $1 and action = 'ADDITIONAL_REVIEWER_RELEASED'`, [bulkDossierId])
      expect(releaseAudit.rows[0]).toMatchObject({ action: 'ADDITIONAL_REVIEWER_RELEASED', details: { previousAdditionalReviewerEmployeeId: employee, archivedDraftCount: 0 } })
      await db.exec('set role authenticated')
      const v2RlsCounts = await db.query<{ rls_count: string; transition_table_rls: boolean }>(`select
        (select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname like 'performance_review_%' and c.relrowsecurity) as rls_count,
        (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'internal_security' and c.relname = 'performance_review_pmux_transition_commands') as transition_table_rls`)
      expect(v2RlsCounts.rows[0]).toEqual({ rls_count: '13', transition_table_rls: true })
    } finally {
      await db.close()
    }
  })
})
