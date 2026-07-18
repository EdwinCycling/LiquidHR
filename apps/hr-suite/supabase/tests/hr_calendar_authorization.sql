begin;
do $$ declare tenant uuid:=md5('tenant:liquid-hr-demo-holding')::uuid;actor uuid;administration uuid;
begin
select id into actor from auth.users where lower(email)='edwin@editsolutions.nl' limit 1;
select id into administration from public.administrations where tenant_id=tenant order by created_at limit 1;
perform set_config('request.jwt.claims',json_build_object('sub',actor,'role','authenticated')::text,true);
if not internal_security.current_user_has_permission(tenant,administration,'hr-calendar:read') then raise exception 'Kalenderrecht ontbreekt voor beheerder.';end if;
end $$;
rollback;
