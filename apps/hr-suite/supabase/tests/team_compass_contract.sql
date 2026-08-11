-- Uit te voeren tegen een gekoppelde Supabase-database na toepassing van de Teamkompas-migratie.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'team_compass_questionnaire_versions', 'team_compass_questions', 'team_compass_campaigns',
    'team_compass_campaign_targets', 'team_compass_participations', 'team_compass_answers', 'team_compass_profiles'
  ] loop
    if not exists (
      select 1 from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public' and relation.relname = table_name and relation.relrowsecurity
    ) then raise exception 'Teamkompas-contract faalt: % ontbreekt of heeft geen RLS.', table_name; end if;
    if has_table_privilege('anon', format('public.%I', table_name), 'select') then
      raise exception 'Teamkompas-contract faalt: anon kan % lezen.', table_name;
    end if;
  end loop;
end
$$;

select count(*) = 40 as questionnaire_has_forty_questions
from public.team_compass_questions
where questionnaire_version_id = md5('team-compass:collaboration:v1')::uuid;

select dimension, count(*) = 10 as dimension_has_ten_questions
from public.team_compass_questions
where questionnaire_version_id = md5('team-compass:collaboration:v1')::uuid
group by dimension
order by dimension;

select count(*) = 4 as permissions_exist
from public.permissions
where code in ('team-compass:manage', 'team-compass:read', 'self:team-compass:read', 'self:team-compass:write');

select count(distinct role.code) = 3 as canonical_roles_are_mapped
from public.role_permissions mapping
join public.management_roles role on role.id = mapping.management_role_id
join public.permissions permission on permission.id = mapping.permission_id
where role.code in ('TENANT_ADMIN', 'DIRECT_MANAGER', 'EMPLOYEE')
  and permission.code like '%team-compass%';

select bool_and(not has_table_privilege('authenticated', format('public.%I', table_name), privilege)) as sensitive_direct_writes_denied
from unnest(array['team_compass_participations', 'team_compass_answers', 'team_compass_profiles']) table_name
cross join unnest(array['insert', 'update', 'delete']) privilege;

select bool_and(not has_function_privilege('anon', procedure.oid, 'execute')) as anon_rpc_execution_denied,
       bool_and(has_function_privilege('authenticated', procedure.oid, 'execute')) as authenticated_rpc_execution_allowed
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.proname in (
    'save_team_compass_campaign', 'start_team_compass_campaign', 'transition_team_compass_campaign',
    'save_team_compass_response', 'get_team_compass_team_projection'
  );

select count(*) >= 7 as read_policies_exist
from pg_policies
where schemaname = 'public' and tablename like 'team_compass_%' and cmd = 'SELECT';
