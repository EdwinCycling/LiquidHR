begin;

do $$
declare
  source_fk record;
begin
  select constraint_row.confdeltype, array_length(constraint_row.conkey, 1) as column_count
  into source_fk
  from pg_constraint constraint_row
  join pg_class relation on relation.oid = constraint_row.conrelid
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = 'ai_memory_items'
    and constraint_row.conname = 'ai_memory_items_source_conversation_fkey';

  if source_fk is null then
    raise exception 'Veilige enkelvoudige memory-conversation-FK ontbreekt.';
  end if;

  if source_fk.confdeltype <> 'n' or source_fk.column_count <> 1 then
    raise exception 'Memory-conversation-FK moet enkelvoudig ON DELETE SET NULL zijn.';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'ai_user_preferences'
      and rowsecurity
  ) then
    raise exception 'ai_user_preferences ontbreekt of RLS staat uit.';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_user_preferences'
      and policyname = 'ai_user_preferences_owner_access'
      and 'authenticated' = any(roles)
  ) then
    raise exception 'Owner/tenant-policy voor ai_user_preferences ontbreekt.';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    join pg_class relation on relation.oid = constraint_row.conrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'ai_user_preferences'
      and constraint_row.contype = 'u'
      and pg_get_constraintdef(constraint_row.oid) like 'UNIQUE (tenant_id, owner_user_id)%'
  ) then
    raise exception 'Unieke tenant-owner voorkeur ontbreekt.';
  end if;
end
$$;

do $$
declare
  required_column text;
begin
  foreach required_column in array array['action_type', 'version', 'control_payload'] loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'ai_action_drafts'
        and column_name = required_column
    ) then
      raise exception 'ai_action_drafts mist kolom %.', required_column;
    end if;
  end loop;
end
$$;

rollback;
