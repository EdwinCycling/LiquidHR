-- P8 security hardening: move the mutation bodies behind internal definer
-- functions. Public PostgREST functions remain invoker wrappers.

alter function public.create_process_definition_draft(uuid, uuid, public.access_scope_type, uuid, text, jsonb, jsonb, jsonb, jsonb)
  rename to create_process_definition_draft_internal;
alter function public.create_process_definition_draft_internal(uuid, uuid, public.access_scope_type, uuid, text, jsonb, jsonb, jsonb, jsonb)
  set schema internal_security;
alter function internal_security.create_process_definition_draft_internal(uuid, uuid, public.access_scope_type, uuid, text, jsonb, jsonb, jsonb, jsonb)
  security definer;
alter function internal_security.create_process_definition_draft_internal(uuid, uuid, public.access_scope_type, uuid, text, jsonb, jsonb, jsonb, jsonb)
  set search_path = pg_catalog;

alter function public.save_process_definition_draft(uuid, integer, jsonb, jsonb)
  rename to save_process_definition_draft_internal;
alter function public.save_process_definition_draft_internal(uuid, integer, jsonb, jsonb)
  set schema internal_security;
alter function internal_security.save_process_definition_draft_internal(uuid, integer, jsonb, jsonb)
  security definer;
alter function internal_security.save_process_definition_draft_internal(uuid, integer, jsonb, jsonb)
  set search_path = pg_catalog;

alter function public.clone_process_definition_draft(uuid, text, jsonb, jsonb)
  rename to clone_process_definition_draft_internal;
alter function public.clone_process_definition_draft_internal(uuid, text, jsonb, jsonb)
  set schema internal_security;
alter function internal_security.clone_process_definition_draft_internal(uuid, text, jsonb, jsonb)
  security definer;
alter function internal_security.clone_process_definition_draft_internal(uuid, text, jsonb, jsonb)
  set search_path = pg_catalog;

alter function public.publish_process_definition_draft(uuid, integer, jsonb, text, integer, text, text)
  rename to publish_process_definition_draft_internal;
alter function public.publish_process_definition_draft_internal(uuid, integer, jsonb, text, integer, text, text)
  set schema internal_security;
alter function internal_security.publish_process_definition_draft_internal(uuid, integer, jsonb, text, integer, text, text)
  security definer;
alter function internal_security.publish_process_definition_draft_internal(uuid, integer, jsonb, text, integer, text, text)
  set search_path = pg_catalog;

alter function public.retire_process_definition(uuid, text)
  rename to retire_process_definition_internal;
alter function public.retire_process_definition_internal(uuid, text)
  set schema internal_security;
alter function internal_security.retire_process_definition_internal(uuid, text)
  security definer;
alter function internal_security.retire_process_definition_internal(uuid, text)
  set search_path = pg_catalog;

create or replace function public.create_process_definition_draft(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_scope_type public.access_scope_type,
  requested_administration_id uuid,
  requested_key text,
  requested_title jsonb,
  requested_description jsonb,
  requested_definition jsonb,
  requested_validation_report jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select internal_security.create_process_definition_draft_internal(
    $1, $2, $3, $4, $5, $6, $7, $8, $9
  );
$$;

create or replace function public.save_process_definition_draft(
  requested_definition_id uuid,
  requested_expected_revision integer,
  requested_definition jsonb,
  requested_validation_report jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select internal_security.save_process_definition_draft_internal($1, $2, $3, $4);
$$;

create or replace function public.clone_process_definition_draft(
  requested_source_definition_id uuid,
  requested_key text,
  requested_title jsonb default null,
  requested_description jsonb default null
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select internal_security.clone_process_definition_draft_internal($1, $2, $3, $4);
$$;

create or replace function public.publish_process_definition_draft(
  requested_definition_id uuid,
  requested_expected_revision integer,
  requested_compiled_definition jsonb,
  requested_definition_hash text,
  requested_schema_version integer,
  requested_compiler_version text,
  requested_changelog text
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select internal_security.publish_process_definition_draft_internal($1, $2, $3, $4, $5, $6, $7);
$$;

create or replace function public.retire_process_definition(
  requested_definition_id uuid,
  requested_reason text
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select internal_security.retire_process_definition_internal($1, $2);
$$;

revoke all on function internal_security.create_process_definition_draft_internal(uuid, uuid, public.access_scope_type, uuid, text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function internal_security.save_process_definition_draft_internal(uuid, integer, jsonb, jsonb) from public, anon, authenticated;
revoke all on function internal_security.clone_process_definition_draft_internal(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function internal_security.publish_process_definition_draft_internal(uuid, integer, jsonb, text, integer, text, text) from public, anon, authenticated;
revoke all on function internal_security.retire_process_definition_internal(uuid, text) from public, anon, authenticated;

revoke all on function public.create_process_definition_draft(uuid, uuid, public.access_scope_type, uuid, text, jsonb, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.save_process_definition_draft(uuid, integer, jsonb, jsonb) from public, anon;
revoke all on function public.clone_process_definition_draft(uuid, text, jsonb, jsonb) from public, anon;
revoke all on function public.publish_process_definition_draft(uuid, integer, jsonb, text, integer, text, text) from public, anon;
revoke all on function public.retire_process_definition(uuid, text) from public, anon;

grant execute on function public.create_process_definition_draft(uuid, uuid, public.access_scope_type, uuid, text, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.save_process_definition_draft(uuid, integer, jsonb, jsonb) to authenticated;
grant execute on function public.clone_process_definition_draft(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function public.publish_process_definition_draft(uuid, integer, jsonb, text, integer, text, text) to authenticated;
grant execute on function public.retire_process_definition(uuid, text) to authenticated;
