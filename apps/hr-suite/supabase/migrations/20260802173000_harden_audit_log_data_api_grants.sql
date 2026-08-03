-- M2.0 security hardening: keep audit logs append-only and out of anon/public Data API access.
-- RLS controls rows; these grants control whether the table is reachable at all.

revoke all on table public.audit_logs from public;
revoke all on table public.audit_logs from anon;
revoke all on table public.audit_logs from authenticated;

grant select on table public.audit_logs to authenticated;

alter table public.audit_logs enable row level security;
