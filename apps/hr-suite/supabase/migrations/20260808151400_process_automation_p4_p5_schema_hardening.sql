begin;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.form_versions'::regclass
      and conname = 'form_versions_tenant_hr_group_id_key'
  ) then
    alter table public.form_versions
      add constraint form_versions_tenant_hr_group_id_key unique (tenant_id, hr_group_id, id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.process_form_responses'::regclass
      and conname = 'process_form_responses_form_version_fkey'
  ) then
    alter table public.process_form_responses
      add constraint process_form_responses_form_version_fkey
      foreign key (tenant_id, hr_group_id, form_version_id)
      references public.form_versions(tenant_id, hr_group_id, id)
      on delete restrict;
  end if;
end;
$$;

commit;
