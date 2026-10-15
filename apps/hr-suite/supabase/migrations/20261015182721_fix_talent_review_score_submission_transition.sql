begin;

create or replace function internal_security.validate_talent_review_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign_row public.talent_review_campaigns;
  assignment_row public.talent_review_assignments;
  member_assignment_id uuid;
  member_manager_id uuid;
  is_hr boolean;
  is_manager boolean;
  is_closing boolean := false;
  is_submitting boolean := false;
begin
  select campaign.* into campaign_row
  from public.talent_review_campaigns campaign
  where campaign.tenant_id = new.tenant_id and campaign.id = new.campaign_id;
  if campaign_row.id is null then raise exception 'TALENT_REVIEW_CAMPAIGN_NOT_FOUND'; end if;
  if tg_op = 'UPDATE' then
    is_closing := new.status = 'CLOSED'
      and old.status = 'SUBMITTED'
      and campaign_row.status in ('ACTIVE', 'HR_REVIEW');
  end if;
  if campaign_row.status <> 'ACTIVE' and not is_closing then raise exception 'TALENT_REVIEW_CAMPAIGN_LOCKED'; end if;

  select assignment.* into assignment_row
  from public.talent_review_assignments assignment
  where assignment.tenant_id = new.tenant_id
    and assignment.campaign_id = new.campaign_id
    and assignment.id = new.assignment_id;
  if assignment_row.id is null then raise exception 'TALENT_REVIEW_ASSIGNMENT_NOT_FOUND'; end if;
  if tg_op = 'UPDATE' then
    is_submitting := new.status = 'SUBMITTED'
      and old.status = 'DRAFT'
      and assignment_row.status = 'SUBMITTED'
      and assignment_row.submitted_by_user_id = (select auth.uid())
      and assignment_row.submitted_at = transaction_timestamp();
  end if;
  if assignment_row.status = 'SUBMITTED' and not is_closing and not is_submitting then
    raise exception 'TALENT_REVIEW_ASSIGNMENT_ALREADY_SUBMITTED';
  end if;

  select member.assignment_id, member.manager_employee_id
    into member_assignment_id, member_manager_id
  from public.talent_review_assignment_members member
  where member.tenant_id = new.tenant_id
    and member.campaign_id = new.campaign_id
    and member.employee_id = new.employee_id;
  if member_assignment_id is null or member_assignment_id <> new.assignment_id or member_manager_id <> new.manager_employee_id then
    raise exception 'TALENT_REVIEW_MEMBER_SCOPE_INVALID';
  end if;
  if new.employee_id = new.manager_employee_id then raise exception 'TALENT_REVIEW_SELF_SCOPE_INVALID'; end if;
  if (select auth.uid()) is null then raise exception 'TALENT_REVIEW_FORBIDDEN'; end if;
  if tg_op = 'INSERT' then
    new.created_by_user_id := (select auth.uid());
  elsif new.created_by_user_id is distinct from old.created_by_user_id then
    raise exception 'TALENT_REVIEW_ACTOR_IMMUTABLE';
  end if;
  new.updated_by_user_id := (select auth.uid());

  is_hr := internal_security.current_user_has_permission(campaign_row.tenant_id, campaign_row.administration_id, 'talent-review:manage');
  is_manager := assignment_row.manager_employee_id = internal_security.current_employee_id()
    and internal_security.current_user_has_permission(campaign_row.tenant_id, campaign_row.administration_id, 'talent-review:write');
  if not (
    (campaign_row.review_mode = 'HR_ONLY' and is_hr)
    or (campaign_row.review_mode = 'MANAGER_ONLY' and is_manager)
    or (campaign_row.review_mode = 'HYBRID' and (is_hr or is_manager))
  ) then raise exception 'TALENT_REVIEW_FORBIDDEN'; end if;

  if tg_op = 'INSERT' and new.status <> 'DRAFT' then raise exception 'TALENT_REVIEW_STATUS_TRANSITION_INVALID'; end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'SUBMITTED'
      and old.status = 'DRAFT'
      and assignment_row.status = 'SUBMITTED'
      and assignment_row.submitted_by_user_id = (select auth.uid())
      and assignment_row.submitted_at = transaction_timestamp() then
      null;
    elsif new.status = 'CLOSED'
      and old.status = 'SUBMITTED'
      and assignment_row.status = 'SUBMITTED'
      and is_hr then
      null;
    elsif new.status = 'DRAFT'
      and old.status in ('SUBMITTED', 'CLOSED')
      and assignment_row.status = 'RETURNED'
      and assignment_row.returned_by_user_id = (select auth.uid())
      and assignment_row.returned_at = transaction_timestamp() then
      null;
    else
      raise exception 'TALENT_REVIEW_STATUS_TRANSITION_INVALID';
    end if;
  end if;
  if new.performance_score is null or new.potential_score is null then
    new.grid_cell := null;
  else
    new.grid_cell := new.performance_score || '_' || new.potential_score;
  end if;
  if tg_op = 'UPDATE' and new.version <> old.version + 1 then raise exception 'TALENT_REVIEW_VERSION_CONFLICT'; end if;
  return new;
end;
$$;

revoke all on function internal_security.validate_talent_review_score() from public, anon, authenticated;

commit;
