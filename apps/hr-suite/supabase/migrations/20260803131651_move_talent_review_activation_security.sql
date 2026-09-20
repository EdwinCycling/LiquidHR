create or replace function internal_security.activate_due_talent_review_campaigns(requested_tenant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  activated_count integer;
begin
  update public.talent_review_campaigns campaign
  set status = 'ACTIVE', version = version + 1, updated_by_user_id = (select auth.uid()), updated_at = timezone('utc', now())
  where campaign.tenant_id = requested_tenant_id
    and campaign.status = 'SCHEDULED'
    and campaign.starts_on <= current_date
    and (
      internal_security.current_user_has_permission(campaign.tenant_id, campaign.administration_id, 'talent-review:manage')
      or exists (
        select 1
        from public.talent_review_assignments assignment
        where assignment.tenant_id = campaign.tenant_id
          and assignment.campaign_id = campaign.id
          and assignment.manager_employee_id = internal_security.current_employee_id()
          and internal_security.current_user_has_permission(campaign.tenant_id, campaign.administration_id, 'talent-review:read')
      )
    );
  get diagnostics activated_count = row_count;
  return activated_count;
end;
$$;

revoke all on function internal_security.activate_due_talent_review_campaigns(uuid) from public, anon, authenticated;
grant execute on function internal_security.activate_due_talent_review_campaigns(uuid) to authenticated;

create or replace function public.activate_due_talent_review_campaigns(requested_tenant_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public, internal_security, auth, pg_temp
as $$
begin
  return internal_security.activate_due_talent_review_campaigns(requested_tenant_id);
end;
$$;

revoke all on function public.activate_due_talent_review_campaigns(uuid) from public, anon;
grant execute on function public.activate_due_talent_review_campaigns(uuid) to authenticated;
