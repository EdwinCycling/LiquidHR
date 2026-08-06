begin;

-- These tables previously inherited broad legacy PUBLIC grants. RLS is not a
-- substitute for least-privilege table grants, so remove anonymous/public
-- access and retain only the explicit authenticated grants from the scope
-- migrations.
revoke all on table
  public.hr_groups,
  public.user_hr_group_access,
  public.administrations
from anon, public;

commit;
