-- CONTROL02 TEST-only finalization advisor follow-up.
-- The two public-schema stores remain inaccessible to authenticated clients;
-- explicit deny policies document that boundary while service_role bypasses RLS.
begin;

create policy payroll_import_xml_provenance_authenticated_deny
  on public.payroll_import_xml_provenance
  for all to authenticated
  using (false)
  with check (false);

create policy payroll_import_protected_identifiers_authenticated_deny
  on public.payroll_import_protected_identifiers
  for all to authenticated
  using (false)
  with check (false);

create index payroll_import_finalization_actions_batch_scope_idx
  on public.payroll_import_finalization_actions (tenant_id, hr_group_id, administration_id, batch_id);
create index payroll_import_finalization_actions_decision_scope_idx
  on public.payroll_import_finalization_actions (tenant_id, hr_group_id, batch_id, decision_id);
create index payroll_import_finalization_plans_batch_scope_idx
  on public.payroll_import_finalization_plans (tenant_id, hr_group_id, administration_id, batch_id);

create or replace function public.control02_test_finalization_schema_ready()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select not exists (
      select 1
      from pg_catalog.unnest(array[
        'public.payroll_import_decisions',
        'public.payroll_import_finalization_plans',
        'public.payroll_import_finalization_plan_events',
        'public.payroll_import_finalization_actions',
        'public.payroll_import_finalization_action_events',
        'public.payroll_import_xml_provenance',
        'public.payroll_import_protected_identifiers'
      ]::text[]) as required(relation_name)
      where pg_catalog.to_regclass(required.relation_name) is null
        or not exists (
          select 1 from pg_catalog.pg_class c
          where c.oid = pg_catalog.to_regclass(required.relation_name)
            and c.relrowsecurity
        )
        or not exists (
          select 1
          from pg_catalog.pg_policy policy
          where policy.polrelid = pg_catalog.to_regclass(required.relation_name)
        )
    )
    and pg_catalog.to_regclass('public.payroll_import_persons_tenant_hr_group_batch_id_key') is not null
    and pg_catalog.to_regclass('public.income_relationships_ikv_employee_active_key') is not null
    and pg_catalog.to_regclass('public.income_relationships_full_lhnr_ikv_active_key') is not null
    and pg_catalog.to_regclass('public.payroll_import_finalization_actions_batch_scope_idx') is not null
    and pg_catalog.to_regclass('public.payroll_import_finalization_actions_decision_scope_idx') is not null
    and pg_catalog.to_regclass('public.payroll_import_finalization_plans_batch_scope_idx') is not null
    and pg_catalog.to_regprocedure('public.execute_control02_test_payroll_finalization_action(uuid,uuid,uuid,text,uuid,uuid,text,jsonb,text)') is not null
    and pg_catalog.has_function_privilege(
      'service_role',
      pg_catalog.to_regprocedure('public.execute_control02_test_payroll_finalization_action(uuid,uuid,uuid,text,uuid,uuid,text,jsonb,text)'),
      'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'authenticated',
      pg_catalog.to_regprocedure('public.execute_control02_test_payroll_finalization_action(uuid,uuid,uuid,text,uuid,uuid,text,jsonb,text)'),
      'EXECUTE'
    )
    and exists (
      select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass('public.income_relationships')
        and a.attname = 'payroll_tax_number'
        and not a.attisdropped
    )
    and exists (
      select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass('public.income_relationships')
        and a.attname = 'payroll_tax_binding_hr_group_id'
        and not a.attisdropped
    )
    and exists (
      select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass('public.income_relationships')
        and a.attname = 'payroll_tax_binding_id'
        and not a.attisdropped
    );
$$;
revoke all on function public.control02_test_finalization_schema_ready() from public, anon, authenticated;
grant execute on function public.control02_test_finalization_schema_ready() to service_role;

commit;
