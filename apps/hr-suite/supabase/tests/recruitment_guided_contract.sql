-- Guided Recruitment stap 3 contractchecks. Verwacht dat stap 1/2/3 migrations actief zijn.
do $$
declare
  item_count integer;
  set_count integer;
  rls_count integer;
begin
  select count(*) into item_count from public.recruitment_library_items where owner_type = 'SYSTEM' and item_type = 'APPLICATION_QUESTION';
  if item_count < 25 then raise exception 'RECRUITMENT_CONTRACT_APPLICATION_QUESTIONS'; end if;
  select count(*) into item_count from public.recruitment_library_items where owner_type = 'SYSTEM' and item_type = 'INTERVIEW_QUESTION';
  if item_count < 84 then raise exception 'RECRUITMENT_CONTRACT_INTERVIEW_QUESTIONS'; end if;
  select count(*) into item_count from public.recruitment_library_items where owner_type = 'SYSTEM' and item_type = 'CRITERION';
  if item_count < 45 then raise exception 'RECRUITMENT_CONTRACT_CRITERIA'; end if;
  select count(*) into item_count from public.recruitment_library_items where owner_type = 'SYSTEM' and item_type = 'PREPARATION';
  if item_count < 35 then raise exception 'RECRUITMENT_CONTRACT_PREPARATION'; end if;
  select count(*) into set_count from public.recruitment_sets where owner_type = 'SYSTEM';
  if set_count < 12 then raise exception 'RECRUITMENT_CONTRACT_SYSTEM_SETS'; end if;
  if exists (
    select 1 from public.recruitment_set_items set_item
    join public.recruitment_library_items item on item.id = set_item.library_item_id
    where item.item_type = 'APPLICATION_QUESTION'
  ) then raise exception 'RECRUITMENT_CONTRACT_APPLICATION_QUESTION_IN_SET'; end if;
  select count(*) into rls_count from pg_class relation join pg_namespace namespace on namespace.oid = relation.relnamespace where namespace.nspname = 'public' and relation.relname like 'recruitment_%' and relation.relrowsecurity;
  if rls_count < 20 then raise exception 'RECRUITMENT_CONTRACT_RLS'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'recruitment_library_system_content_guard') then raise exception 'RECRUITMENT_CONTRACT_SYSTEM_GUARD'; end if;
  if not exists (select 1 from public.recruitment_settings where retention_days = 28) then raise exception 'RECRUITMENT_CONTRACT_DEFAULT_RETENTION'; end if;
end;
$$;

select 'recruitment_guided_contract_ok' as result;
