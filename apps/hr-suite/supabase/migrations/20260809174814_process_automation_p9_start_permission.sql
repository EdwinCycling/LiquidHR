begin;
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
  if not (
    internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'process-instance:start')
    or internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'self:process-instance:start')
  ) then
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

commit;