begin;
do $$ declare tenant uuid:=md5('tenant:liquid-hr-demo-holding')::uuid;actor uuid;employee uuid;administration uuid; event_count integer;
begin
select id into actor from auth.users where lower(email)='edwin@editsolutions.nl' limit 1;
select assignment.employee_id,assignment.administration_id into employee,administration from public.employee_administration_assignments assignment where assignment.tenant_id=tenant order by assignment.effective_from limit 1;
perform set_config('request.jwt.claims',json_build_object('sub',actor,'role','authenticated')::text,true);
select count(*) into event_count from public.hr_change_events event where event.employee_id=employee and event.administration_id=administration;
if event_count=0 then raise exception 'HR-eventprojectie bevat geen gebeurtenissen.';end if;
if exists(select 1 from public.hr_change_events where event_date is null or event_id is null or source_href is null) then raise exception 'HR-eventprojectie bevat onvolledige events.';end if;
end $$;
rollback;
