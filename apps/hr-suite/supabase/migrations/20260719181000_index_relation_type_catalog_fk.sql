create index if not exists employee_relations_tenant_relation_type_idx
  on public.employee_relations (tenant_id, relation_type);
