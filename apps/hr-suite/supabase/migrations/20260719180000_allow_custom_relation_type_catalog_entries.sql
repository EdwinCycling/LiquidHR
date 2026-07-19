alter table public.relation_types
  drop constraint relation_types_tenant_code_key;

alter table public.relation_types
  alter column code type text using code::text;

alter table public.relation_types
  add constraint relation_types_code_format check (code ~ '^[A-Z][A-Z0-9_ -]{1,39}$'),
  add constraint relation_types_tenant_code_key unique (tenant_id, code);

alter table public.employee_relations
  alter column relation_type type text using relation_type::text;

alter table public.employee_relations
  add constraint employee_relations_relation_type_format check (relation_type ~ '^[A-Z][A-Z0-9_ -]{1,39}$'),
  add constraint employee_relations_relation_type_catalog_fkey
    foreign key (tenant_id, relation_type)
    references public.relation_types (tenant_id, code)
    on update cascade on delete restrict;

create index employee_relations_tenant_relation_type_idx
  on public.employee_relations (tenant_id, relation_type);
