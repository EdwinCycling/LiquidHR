create policy audit_logs_insert_bsn_reveal
on public.audit_logs for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and action = 'REVEAL'
  and entity_name = 'employee'
  and changes = '{"field":"bsn"}'::jsonb
  and (select internal_security.employee_secure_identifier_can_read(tenant_id, entity_id))
);

grant insert (
  tenant_id, administration_id, entity_name, entity_id,
  actor_user_id, action, changes
) on public.audit_logs to authenticated;
