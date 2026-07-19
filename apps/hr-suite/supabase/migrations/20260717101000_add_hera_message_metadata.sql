alter table public.ai_messages
add column metadata jsonb not null default '{}'::jsonb;
