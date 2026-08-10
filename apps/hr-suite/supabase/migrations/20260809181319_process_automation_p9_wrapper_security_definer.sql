begin;

create or replace function public.get_process_recipe_catalog()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.get_process_recipe_catalog_internal();
$$;

create or replace function public.activate_process_recipe(
  requested_recipe_id uuid,
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_scope_type public.access_scope_type,
  requested_administration_id uuid,
  requested_key text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.activate_process_recipe_internal(
    requested_recipe_id, requested_tenant_id, requested_hr_group_id,
    requested_scope_type, requested_administration_id, requested_key
  );
$$;

create or replace function public.get_process_recipe_start_context(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_recipe_key text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.get_process_recipe_start_context_internal(
    requested_tenant_id, requested_hr_group_id, requested_recipe_key
  );
$$;

create or replace function public.get_internal_transfer_preview(requested_work_item_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.internal_transfer_projection(requested_work_item_id);
$$;

create or replace function public.commit_internal_transfer(
  requested_work_item_id uuid,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.commit_internal_transfer(
    requested_work_item_id,
    requested_expected_version,
    requested_step_expected_version,
    requested_idempotency_key,
    requested_correlation_id
  );
$$;

create or replace function public.request_process_work_item_changes(
  requested_work_item_id uuid,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid,
  requested_body text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.request_process_work_item_changes(
    requested_work_item_id,
    requested_expected_version,
    requested_step_expected_version,
    requested_idempotency_key,
    requested_correlation_id,
    requested_body
  );
$$;

commit;
