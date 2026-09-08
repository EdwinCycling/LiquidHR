begin;

-- Cover every Payroll foreign key that is not already covered by a composite
-- scope/history index. This keeps the new P0 tables advisor-clean without
-- changing their access model.
create index if not exists payroll_audit_events_actor_user_idx
  on public.payroll_audit_events (actor_user_id);
create index if not exists payroll_audit_events_administration_idx
  on public.payroll_audit_events (tenant_id, hr_group_id, administration_id);
create index if not exists payroll_audit_events_binding_idx
  on public.payroll_audit_events (tenant_id, hr_group_id, connection_id, company_binding_id);
create index if not exists payroll_audit_events_provider_idx
  on public.payroll_audit_events (provider_id);
create index if not exists payroll_company_bindings_bound_by_user_idx
  on public.payroll_company_bindings (bound_by_user_id);
create index if not exists payroll_connections_connected_by_user_idx
  on public.payroll_connections (connected_by_user_id);
create index if not exists payroll_connections_provider_id_idx
  on public.payroll_connections (provider_id);
create index if not exists payroll_sync_issues_item_idx
  on public.payroll_sync_issues (tenant_id, hr_group_id, sync_run_id, sync_item_id);
create index if not exists payroll_sync_runs_binding_fk_idx
  on public.payroll_sync_runs (tenant_id, hr_group_id, connection_id, company_binding_id);
create index if not exists payroll_sync_runs_connection_fk_idx
  on public.payroll_sync_runs (tenant_id, hr_group_id, connection_id);
create index if not exists payroll_sync_runs_started_by_user_idx
  on public.payroll_sync_runs (started_by_user_id);

commit;
