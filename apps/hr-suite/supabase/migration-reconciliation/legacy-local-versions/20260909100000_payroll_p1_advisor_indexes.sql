begin;

-- Cover the private OAuth state foreign keys without exposing the table or
-- changing the server-only access boundary.
create index payroll_oauth_states_provider_idx
  on payroll_private.payroll_oauth_states (provider_id);

create index payroll_oauth_states_initiated_by_user_idx
  on payroll_private.payroll_oauth_states (initiated_by_user_id);

commit;
