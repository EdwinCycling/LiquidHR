begin;
create or replace function internal_security.get_process_recipe_catalog_internal()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', recipe.id,
      'recipeKey', recipe.recipe_key,
      'recipeVersion', recipe.recipe_version,
      'title', recipe.title,
      'description', recipe.description,
      'adapterKey', recipe.adapter_key,
      'status', recipe.status
    ) order by recipe.recipe_key, recipe.recipe_version desc)
    from public.process_recipe_catalog recipe
    where recipe.status = 'PUBLISHED'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_process_recipe_catalog()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.get_process_recipe_catalog_internal();
$$;

create or replace function internal_security.activate_process_recipe_internal(
  requested_recipe_id uuid,
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_scope_type public.access_scope_type,
  requested_administration_id uuid,
  requested_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  recipe_row public.process_recipe_catalog%rowtype;
  activation_row public.process_recipe_activations%rowtype;
  definition_result jsonb;
  definition_id uuid;
  definition_key text;
  definition_json jsonb;
begin
  if actor_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if not internal_security.current_user_has_hr_group_permission(
    requested_tenant_id, requested_hr_group_id, 'process-definition:write'
  ) then raise exception 'PROCESS_RECIPE_FORBIDDEN' using errcode = '42501'; end if;

  select recipe.* into recipe_row
  from public.process_recipe_catalog recipe
  where recipe.id = requested_recipe_id
    and recipe.status = 'PUBLISHED';
  if recipe_row.id is null then raise exception 'PROCESS_RECIPE_NOT_FOUND' using errcode = 'P0002'; end if;

  select activation.* into activation_row
  from public.process_recipe_activations activation
  where activation.tenant_id = requested_tenant_id
    and activation.hr_group_id = requested_hr_group_id
    and activation.process_recipe_id = requested_recipe_id;
  if activation_row.id is not null then
    return jsonb_build_object(
      'activationId', activation_row.id,
      'processDefinitionId', activation_row.process_definition_id,
      'recipeId', recipe_row.id,
      'recipeKey', recipe_row.recipe_key,
      'recipeVersion', recipe_row.recipe_version,
      'existing', true
    );
  end if;

  definition_key := coalesce(nullif(btrim(requested_key), ''), recipe_row.recipe_key || '-v' || recipe_row.recipe_version::text);
  if definition_key !~ '^[a-z][a-z0-9_-]*$' then raise exception 'PROCESS_RECIPE_INVALID_KEY' using errcode = '22023'; end if;
  definition_json := jsonb_set(recipe_row.definition_json, '{key}', to_jsonb(definition_key), true);
  select public.create_process_definition_draft(
    requested_tenant_id,
    requested_hr_group_id,
    requested_scope_type,
    requested_administration_id,
    definition_key,
    recipe_row.title,
    recipe_row.description,
    definition_json,
    jsonb_build_object('source', 'CERTIFIED_RECIPE', 'recipeKey', recipe_row.recipe_key, 'recipeVersion', recipe_row.recipe_version, 'adapterKey', recipe_row.adapter_key)
  ) into definition_result;
  definition_id := (definition_result ->> 'id')::uuid;

  insert into public.process_recipe_activations (
    tenant_id, hr_group_id, process_recipe_id, process_definition_id, activated_by_user_id
  ) values (
    requested_tenant_id, requested_hr_group_id, requested_recipe_id, definition_id, actor_id
  ) returning * into activation_row;

  insert into public.audit_logs (
    tenant_id, entity_name, entity_id, actor_user_id, action, changes
  ) values (
    requested_tenant_id, 'process_recipe_activation', activation_row.id, actor_id, 'CREATE',
    jsonb_build_object('recipeKey', recipe_row.recipe_key, 'recipeVersion', recipe_row.recipe_version, 'processDefinitionId', definition_id)
  );

  return jsonb_build_object(
    'activationId', activation_row.id,
    'processDefinitionId', definition_id,
    'recipeId', recipe_row.id,
    'recipeKey', recipe_row.recipe_key,
    'recipeVersion', recipe_row.recipe_version,
    'definitionKey', definition_key,
    'existing', false
  );
end;
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
security invoker
set search_path = ''
as $$
  select internal_security.activate_process_recipe_internal(
    requested_recipe_id, requested_tenant_id, requested_hr_group_id,
    requested_scope_type, requested_administration_id, requested_key
  );
$$;

create or replace function internal_security.get_process_recipe_start_context_internal(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_recipe_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  definition_row public.process_definitions%rowtype;
  recipe_row public.process_recipe_catalog%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'process-instance:start') then
    raise exception 'PROCESS_RECIPE_START_FORBIDDEN' using errcode = '42501';
  end if;
  select recipe.* into recipe_row
  from public.process_recipe_catalog recipe
  where recipe.recipe_key = requested_recipe_key and recipe.status = 'PUBLISHED'
  order by recipe.recipe_version desc limit 1;
  if recipe_row.id is null then raise exception 'PROCESS_RECIPE_NOT_FOUND' using errcode = 'P0002'; end if;
  select definition.* into definition_row
  from public.process_definitions definition
  join public.process_recipe_activations activation
    on activation.process_definition_id = definition.id
   and activation.tenant_id = requested_tenant_id
   and activation.hr_group_id = requested_hr_group_id
   and activation.process_recipe_id = recipe_row.id
  where definition.status = 'PUBLISHED'
  order by definition.updated_at desc limit 1;
  if definition_row.id is null then raise exception 'PROCESS_RECIPE_NOT_ACTIVATED' using errcode = '40901'; end if;
  return jsonb_build_object(
    'recipeId', recipe_row.id,
    'recipeKey', recipe_row.recipe_key,
    'recipeVersion', recipe_row.recipe_version,
    'adapterKey', recipe_row.adapter_key,
    'processDefinitionId', definition_row.id,
    'definitionKey', definition_row.key,
    'title', definition_row.title,
    'description', definition_row.description
  );
end;
$$;

create or replace function public.get_process_recipe_start_context(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_recipe_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.get_process_recipe_start_context_internal(
    requested_tenant_id, requested_hr_group_id, requested_recipe_key
  );
$$;

commit;