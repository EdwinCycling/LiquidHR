-- Keep the M2.1 personal capability table reachable only through its
-- intended authenticated Data API operations. RLS remains the row boundary.
revoke all on table public.talent_employee_capability_records from public;
revoke all on table public.talent_employee_capability_records from anon;
revoke all on table public.talent_employee_capability_records from authenticated;
grant select, insert, update on table public.talent_employee_capability_records to authenticated;
