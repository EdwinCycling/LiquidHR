-- Keep the personal logbook private at both the table-grant and RLS layers.
revoke all on table public.personal_logbook_entries from public, anon;
grant select, insert, update, delete on table public.personal_logbook_entries to authenticated;

