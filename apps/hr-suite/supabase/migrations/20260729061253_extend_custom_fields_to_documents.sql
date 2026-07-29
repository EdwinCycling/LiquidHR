-- The document dossier is the second supported custom-field entity. Values are
-- kept on the private document record; they inherit its existing RLS scope.
alter type public.custom_field_entity_type add value if not exists 'DOCUMENT';

alter table public.employee_documents
  add column if not exists custom_fields jsonb not null default '{}'::jsonb,
  add constraint employee_documents_custom_fields_object
    check (jsonb_typeof(custom_fields) = 'object');
