create index if not exists ai_memory_items_source_conversation_idx
on public.ai_memory_items (source_conversation_id)
where source_conversation_id is not null;

create index if not exists ai_user_preferences_owner_idx
on public.ai_user_preferences (owner_user_id);
