-- Remove unauthenticated access to the W04 mapping table without changing
-- authenticated, service-role, policy, or default-privilege contracts.
revoke all privileges on table public.actual_work_payroll_mappings from anon, public;
