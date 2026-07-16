create index audit_logs_actor_user_id_idx
  on public.audit_logs (actor_user_id)
  where actor_user_id is not null;

create index audit_logs_administration_scope_idx
  on public.audit_logs (tenant_id, administration_id)
  where administration_id is not null;
