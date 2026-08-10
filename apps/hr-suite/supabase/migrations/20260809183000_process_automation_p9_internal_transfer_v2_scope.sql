begin;

-- P9 v2 keeps the certified starter immutable while making the employment
-- subject explicitly administration-scoped through the normal activation RPC.
insert into public.process_recipe_catalog (
  recipe_key,
  recipe_version,
  title,
  description,
  adapter_key,
  definition_json
)
select
  recipe.recipe_key,
  2,
  recipe.title,
  recipe.description,
  recipe.adapter_key,
  recipe.definition_json
from public.process_recipe_catalog recipe
where recipe.recipe_key = 'internal-transfer'
  and recipe.recipe_version = 1
on conflict (recipe_key, recipe_version) do update
set title = excluded.title,
    description = excluded.description,
    adapter_key = excluded.adapter_key,
    definition_json = excluded.definition_json,
    status = 'PUBLISHED';

comment on table public.process_recipe_catalog is 'P9 immutable catalogue of certified, versioned process starters; v2 is administration-scoped at activation for employment subjects.';

commit;
