-- ESS/MSS Workflow Unification V1 keeps Leave's domain status explicit.
-- The values are added in a separate migration because PostgreSQL only makes
-- newly added enum labels usable after the migration transaction commits.
alter type public.leave_request_status add value if not exists 'PENDING';
alter type public.leave_request_status add value if not exists 'CHANGES_REQUESTED';

