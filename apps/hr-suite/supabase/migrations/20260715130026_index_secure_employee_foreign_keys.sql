create index employee_custom_field_values_definition_scope_idx
  on public.employee_custom_field_values (
    tenant_id, administration_id, definition_id, field_key
  );
create index employee_custom_field_values_employee_scope_idx
  on public.employee_custom_field_values (tenant_id, employee_id);
create index employee_secure_identifiers_employee_scope_idx
  on public.employee_secure_identifiers (tenant_id, employee_id);
