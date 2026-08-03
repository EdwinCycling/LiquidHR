begin;

drop policy if exists audit_logs_insert_bsn_reveal on public.audit_logs;
drop policy if exists audit_logs_insert_talent_export on public.audit_logs;

create policy audit_logs_insert_authorized_events
on public.audit_logs for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and (
    (
      action = 'REVEAL'
      and entity_name = 'employee'
      and changes = '{"field":"bsn"}'::jsonb
      and (select internal_security.employee_secure_identifier_can_read(tenant_id, entity_id))
    )
    or (
      action = 'EXPORT'
      and entity_name = 'talent_export'
      and entity_id = tenant_id
      and jsonb_typeof(changes) = 'object'
      and changes ->> 'format' = 'csv'
      and case
        when changes ->> 'record_count' ~ '^[0-9]+$'
          then (changes ->> 'record_count')::numeric >= 0
        else false
      end
      and changes ->> 'scope' in ('admin', 'manager', 'self')
      and (
        ((changes ->> 'scope') = 'self' and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-export:read')))
        or ((changes ->> 'scope') in ('admin', 'manager') and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-export:read')))
      )
    )
  )
);

commit;
