create or replace function internal_security.link_employee_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;
  end if;

  update public.employees employee
  set auth_user_id = new.id
  where employee.auth_user_id is null
    and employee.deleted_at is null
    and (
      lower(employee.work_email) = lower(new.email)
      or lower(employee.private_email) = lower(new.email)
    );

  return new;
end;
$$;

revoke all on function internal_security.link_employee_from_auth_user() from public, anon, authenticated;

update public.employees employee
set auth_user_id = auth_user.id
from auth.users auth_user
where employee.auth_user_id is null
  and employee.deleted_at is null
  and auth_user.email is not null
  and (
    lower(employee.work_email) = lower(auth_user.email)
    or lower(employee.private_email) = lower(auth_user.email)
  );

drop trigger if exists link_employee_after_auth_user_write on auth.users;
create trigger link_employee_after_auth_user_write
after insert or update of email on auth.users
for each row execute function internal_security.link_employee_from_auth_user();

drop function if exists public.bootstrap_current_employee();
