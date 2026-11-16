-- CONTROL01 CONVERGENCE_REQUIRED
-- Static migration only. Do not apply to a shared or remote Supabase project in
-- this run. The enum value is intentionally isolated because PostgreSQL does
-- not allow a newly-added enum value to be used earlier in the same
-- transaction.

alter type public.invitation_purpose
  add value if not exists 'TENANT_FIRST_ADMIN';
