select
  to_regclass('public.relation_types') is not null as relation_types_exists,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'relation_types' and column_name = 'code' and data_type = 'text') as relation_codes_are_text,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'employee_relations' and column_name = 'relation_type' and data_type = 'text') as employee_relation_codes_are_text,
  exists (select 1 from pg_constraint where conname = 'employee_relations_relation_type_catalog_fkey') as relation_catalog_fk_exists;
