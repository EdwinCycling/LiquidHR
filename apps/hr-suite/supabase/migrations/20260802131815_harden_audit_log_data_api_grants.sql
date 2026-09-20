revoke all on table public.audit_logs from public;
revoke all on table public.audit_logs from anon;
revoke all on table public.audit_logs from authenticated;
grant select on table public.audit_logs to authenticated;
alter table public.audit_logs enable row level security;