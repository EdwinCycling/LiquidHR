begin;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'surveys', 'survey_questions', 'survey_question_options', 'survey_matrix_rows',
    'survey_invitations', 'survey_responses', 'survey_answers',
    'enps_question_bank_categories', 'enps_question_bank', 'enps_campaigns',
    'enps_questions', 'enps_invitations', 'enps_responses', 'enps_answers'
  ] loop
    if not exists (
      select 1 from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = table_name
        and relation.relrowsecurity
    ) then
      raise exception 'RLS ontbreekt op public.%', table_name;
    end if;
  end loop;
end;
$$;

do $$
begin
  if (select count(*) from public.enps_question_bank_categories where is_system) <> 15 then
    raise exception 'De eNPS-vragenbank moet exact 15 categorieën bevatten.';
  end if;
  if (select count(*) from public.enps_question_bank where is_system) <> 150 then
    raise exception 'De eNPS-vragenbank moet exact 150 vragen bevatten.';
  end if;
  if (select count(*) from public.enps_question_bank where is_mandatory_enps) <> 1 then
    raise exception 'De eNPS-vragenbank moet exact één verplichte hoofdvraag bevatten.';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'enps_responses'
      and column_name in ('user_id', 'employee_id', 'email', 'ip_address', 'device_hash')
  ) then
    raise exception 'enps_responses bevat een herleidbaar veld.';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'enps_invitations'
      and column_name in ('submitted_at', 'response_id')
  ) then
    raise exception 'enps_invitations mag geen responsmoment of responskoppeling bevatten.';
  end if;
  if exists (
    select 1 from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'update_survey_draft', 'update_enps_draft',
        'submit_survey_response', 'submit_enps_response'
      )
      and not procedure.prosecdef
  ) then
    raise exception 'De publieke researchfuncties moeten als afgeschermde security-definer wrappers draaien.';
  end if;
  if exists (
    select 1 from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'update_survey_draft', 'update_enps_draft',
        'submit_survey_response', 'submit_enps_response'
      )
      and not has_function_privilege('authenticated', procedure.oid, 'execute')
  ) then
    raise exception 'Authenticated execute ontbreekt op een publieke researchwrapper.';
  end if;
  if exists (
    select 1 from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'internal_security'
      and procedure.proname in (
        'update_survey_draft', 'update_enps_draft',
        'submit_survey_response', 'submit_enps_response'
      )
      and has_function_privilege('authenticated', procedure.oid, 'execute')
  ) then
    raise exception 'Authenticated mag de interne researchkern niet rechtstreeks uitvoeren.';
  end if;
  if exists (
    select 1 from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'internal_security')
      and procedure.proname in (
        'update_survey_draft', 'update_enps_draft',
        'submit_survey_response', 'submit_enps_response'
      )
      and has_function_privilege('anon', procedure.oid, 'execute')
  ) then
    raise exception 'Anon mag de researchfuncties niet uitvoeren.';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('enps_responses', 'enps_answers')
      and policyname like '%results_read'
      and qual like '%enps_campaign_has_minimum_responses%'
    group by schemaname
    having count(*) = 2
  ) then
    raise exception 'De eNPS-resultaatpolicies moeten de privacydrempel in de database afdwingen.';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('enps_question_bank_categories', 'enps_question_bank')
      and policyname like '%hr_read'
      and qual not like '%current_user_can_manage_research_question_bank%'
  ) then
    raise exception 'De globale eNPS-vragenbank mag niet voor iedere ingelogde gebruiker leesbaar zijn.';
  end if;
  if exists (
    select 1 from public.role_permissions role_permission
    join public.management_roles role on role.id = role_permission.management_role_id
    join public.permissions permission on permission.id = role_permission.permission_id
    where role.code = 'DIRECT_MANAGER'
      and permission.code in ('research:read', 'research:write', 'research-result:read')
  ) then
    raise exception 'DIRECT_MANAGER mag geen researchbeheer of resultaten krijgen.';
  end if;
end;
$$;

rollback;
