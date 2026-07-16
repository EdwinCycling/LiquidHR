begin;

do $$
declare
  required_table text;
begin
  foreach required_table in array array[
    'ai_conversations',
    'ai_messages',
    'ai_memory_items',
    'ai_action_drafts'
  ] loop
    if not exists (
      select 1
      from pg_tables
      where schemaname = 'public'
        and tablename = required_table
        and rowsecurity
    ) then
      raise exception 'HeRa-tabel % mist RLS.', required_table;
    end if;
  end loop;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_messages_conversation_same_tenant_fkey'
  ) then
    raise exception 'HeRa-berichten missen de tenantgebonden conversation-FK.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_action_drafts_idempotency_key_key'
  ) then
    raise exception 'HeRa-conceptacties missen de idempotency-constraint.';
  end if;
end
$$;

rollback;
