alter table public.tenant_modules drop constraint if exists tenant_modules_module_code_check;
alter table public.tenant_modules add constraint tenant_modules_module_code_check
  check (module_code = any (array['HERA', 'DOCUMENTS', 'REMINDERS', 'TALENT', 'SURVEYS', 'ENPS', 'TEAM_COMPASS']::text[]));

insert into public.tenant_modules (tenant_id, module_code, is_enabled, enabled_at)
select tenant.id, 'TEAM_COMPASS', true, timezone('utc', now())
from public.tenants tenant
on conflict (tenant_id, module_code) do update
set is_enabled = true,
    enabled_at = coalesce(public.tenant_modules.enabled_at, excluded.enabled_at),
    disabled_at = null,
    disabled_by = null;

insert into public.permissions (code, name, category, description)
values
  ('team-compass:manage', 'Teamkompas beheren', 'Teamkompas', 'Beheert campagnes en leest veilige groepsprojecties binnen de HR-groep.'),
  ('team-compass:read', 'Teamkompas teaminzichten lezen', 'Teamkompas', 'Leest veilige Teamkompas-projecties binnen de actuele managementscope.'),
  ('self:team-compass:read', 'Eigen Teamkompas lezen', 'Teamkompas', 'Leest uitsluitend eigen uitnodigingen en resultaten.'),
  ('self:team-compass:write', 'Eigen Teamkompas invullen', 'Teamkompas', 'Slaat uitsluitend eigen antwoorden en deeltoestemming op.')
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code in ('team-compass:manage', 'team-compass:read')
where role.code = 'TENANT_ADMIN'
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code = 'team-compass:read'
where role.code = 'DIRECT_MANAGER'
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code in ('self:team-compass:read', 'self:team-compass:write')
where role.code = 'EMPLOYEE'
on conflict do nothing;

create table public.team_compass_questionnaire_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version integer not null check (version > 0),
  name_nl text not null,
  name_en text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'RETIRED')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (code, version)
);

create table public.team_compass_questions (
  id uuid primary key default gen_random_uuid(),
  questionnaire_version_id uuid not null references public.team_compass_questionnaire_versions(id) on delete restrict,
  code text not null,
  dimension text not null check (dimension in ('ACTION', 'VISION', 'HARMONY', 'LOGIC')),
  prompt_nl text not null,
  prompt_en text not null,
  sort_order smallint not null check (sort_order between 1 and 40),
  created_at timestamptz not null default timezone('utc', now()),
  unique (questionnaire_version_id, code),
  unique (questionnaire_version_id, sort_order),
  unique (questionnaire_version_id, id)
);

create table public.team_compass_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hr_group_id uuid not null,
  questionnaire_version_id uuid not null references public.team_compass_questionnaire_versions(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text,
  personal_message text,
  starts_on date not null default current_date,
  ends_on date not null,
  anonymity_threshold smallint not null default 5 check (anonymity_threshold between 5 and 50),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED')),
  version integer not null default 1 check (version > 0),
  started_at timestamptz,
  closed_at timestamptz,
  archived_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint team_compass_campaigns_hr_group_fkey
    foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete restrict,
  constraint team_compass_campaign_dates_valid check (ends_on >= starts_on),
  unique (tenant_id, hr_group_id, id)
);

create table public.team_compass_campaign_targets (
  tenant_id uuid not null,
  hr_group_id uuid not null,
  campaign_id uuid not null,
  department_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (campaign_id, department_id),
  constraint team_compass_campaign_targets_campaign_fkey
    foreign key (tenant_id, hr_group_id, campaign_id)
    references public.team_compass_campaigns(tenant_id, hr_group_id, id) on delete cascade,
  constraint team_compass_campaign_targets_department_fkey
    foreign key (tenant_id, hr_group_id, department_id)
    references public.departments(tenant_id, hr_group_id, id) on delete restrict
);

create table public.team_compass_participations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  campaign_id uuid not null,
  employee_id uuid not null,
  department_id uuid not null,
  status text not null default 'INVITED' check (status in ('INVITED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED')),
  share_outer_profile boolean not null default false,
  share_inner_profile boolean not null default false,
  version integer not null default 1 check (version > 0),
  invited_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint team_compass_participations_campaign_fkey
    foreign key (tenant_id, hr_group_id, campaign_id)
    references public.team_compass_campaigns(tenant_id, hr_group_id, id) on delete restrict,
  constraint team_compass_participations_employee_fkey
    foreign key (tenant_id, hr_group_id, employee_id)
    references public.employees(tenant_id, hr_group_id, id) on delete restrict,
  constraint team_compass_participations_department_fkey
    foreign key (tenant_id, hr_group_id, department_id)
    references public.departments(tenant_id, hr_group_id, id) on delete restrict,
  constraint team_compass_participations_inner_requires_outer check (not share_inner_profile or share_outer_profile),
  unique (tenant_id, hr_group_id, campaign_id, employee_id),
  unique (tenant_id, hr_group_id, id)
);

create table public.team_compass_answers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  participation_id uuid not null,
  question_id uuid not null references public.team_compass_questions(id) on delete restrict,
  inner_score smallint not null check (inner_score between 1 and 5),
  outer_score smallint not null check (outer_score between 1 and 5),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint team_compass_answers_participation_fkey
    foreign key (tenant_id, hr_group_id, participation_id)
    references public.team_compass_participations(tenant_id, hr_group_id, id) on delete cascade,
  unique (participation_id, question_id)
);

create table public.team_compass_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  participation_id uuid not null,
  inner_action numeric(6,2) not null check (inner_action between 0 and 100),
  inner_vision numeric(6,2) not null check (inner_vision between 0 and 100),
  inner_harmony numeric(6,2) not null check (inner_harmony between 0 and 100),
  inner_logic numeric(6,2) not null check (inner_logic between 0 and 100),
  outer_action numeric(6,2) not null check (outer_action between 0 and 100),
  outer_vision numeric(6,2) not null check (outer_vision between 0 and 100),
  outer_harmony numeric(6,2) not null check (outer_harmony between 0 and 100),
  outer_logic numeric(6,2) not null check (outer_logic between 0 and 100),
  inner_x numeric(7,2) not null check (inner_x between -100 and 100),
  inner_y numeric(7,2) not null check (inner_y between -100 and 100),
  outer_x numeric(7,2) not null check (outer_x between -100 and 100),
  outer_y numeric(7,2) not null check (outer_y between -100 and 100),
  shift_distance numeric(7,2) not null check (shift_distance between 0 and 282.85),
  shift_band text not null check (shift_band in ('LOW', 'MEDIUM', 'HIGH')),
  primary_dimension text not null check (primary_dimension in ('ACTION', 'VISION', 'HARMONY', 'LOGIC')),
  secondary_dimension text not null check (secondary_dimension in ('ACTION', 'VISION', 'HARMONY', 'LOGIC')),
  calculated_at timestamptz not null default timezone('utc', now()),
  constraint team_compass_profiles_participation_fkey
    foreign key (tenant_id, hr_group_id, participation_id)
    references public.team_compass_participations(tenant_id, hr_group_id, id) on delete cascade,
  unique (participation_id)
);

create index team_compass_campaigns_scope_status_idx
  on public.team_compass_campaigns (tenant_id, hr_group_id, status, ends_on desc);
create index team_compass_campaigns_questionnaire_version_idx
  on public.team_compass_campaigns (questionnaire_version_id);
create index team_compass_campaigns_created_by_user_idx
  on public.team_compass_campaigns (created_by_user_id);
create index team_compass_campaigns_updated_by_user_idx
  on public.team_compass_campaigns (updated_by_user_id);
create index team_compass_campaign_targets_scope_idx
  on public.team_compass_campaign_targets (tenant_id, hr_group_id, department_id, campaign_id);
create index team_compass_campaign_targets_campaign_idx
  on public.team_compass_campaign_targets (tenant_id, hr_group_id, campaign_id);
create index team_compass_participations_campaign_status_idx
  on public.team_compass_participations (tenant_id, hr_group_id, campaign_id, status);
create index team_compass_participations_employee_idx
  on public.team_compass_participations (tenant_id, hr_group_id, employee_id, updated_at desc);
create index team_compass_participations_department_idx
  on public.team_compass_participations (tenant_id, hr_group_id, department_id, campaign_id);
create index team_compass_answers_participation_idx
  on public.team_compass_answers (tenant_id, hr_group_id, participation_id);
create index team_compass_answers_question_idx
  on public.team_compass_answers (question_id);
create index team_compass_profiles_scope_idx
  on public.team_compass_profiles (tenant_id, hr_group_id, participation_id);

create or replace function internal_security.prevent_team_compass_template_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'TEAM_COMPASS_TEMPLATE_IMMUTABLE';
end;
$$;

revoke all on function internal_security.prevent_team_compass_template_mutation() from public, anon, authenticated;

create trigger prevent_team_compass_questionnaire_mutation
before update or delete on public.team_compass_questionnaire_versions
for each row execute function internal_security.prevent_team_compass_template_mutation();
create trigger prevent_team_compass_question_mutation
before update or delete on public.team_compass_questions
for each row execute function internal_security.prevent_team_compass_template_mutation();

create trigger team_compass_campaigns_updated
before update on public.team_compass_campaigns
for each row execute function internal_security.set_updated_at();
create trigger team_compass_participations_updated
before update on public.team_compass_participations
for each row execute function internal_security.set_updated_at();
create trigger team_compass_answers_updated
before update on public.team_compass_answers
for each row execute function internal_security.set_updated_at();

create trigger audit_team_compass_campaigns
after insert or update on public.team_compass_campaigns
for each row execute function internal_security.audit_configuration_change('team_compass_campaign');
create trigger audit_team_compass_campaign_targets
after insert or delete on public.team_compass_campaign_targets
for each row execute function internal_security.audit_configuration_change('team_compass_campaign_target');
create trigger audit_team_compass_participations
after insert or update on public.team_compass_participations
for each row execute function internal_security.audit_configuration_change('team_compass_participation');

alter table public.team_compass_questionnaire_versions enable row level security;
alter table public.team_compass_questions enable row level security;
alter table public.team_compass_campaigns enable row level security;
alter table public.team_compass_campaign_targets enable row level security;
alter table public.team_compass_participations enable row level security;
alter table public.team_compass_answers enable row level security;
alter table public.team_compass_profiles enable row level security;

create policy team_compass_questionnaire_versions_select
on public.team_compass_questionnaire_versions for select to authenticated
using (true);

create policy team_compass_questions_select
on public.team_compass_questions for select to authenticated
using (true);

create policy team_compass_campaigns_select
on public.team_compass_campaigns for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'team-compass:manage'))
  or exists (
    select 1 from public.team_compass_participations participation
    where participation.tenant_id = public.team_compass_campaigns.tenant_id
      and participation.hr_group_id = public.team_compass_campaigns.hr_group_id
      and participation.campaign_id = public.team_compass_campaigns.id
      and (
        participation.employee_id = (
          select internal_security.current_employee_id(
            public.team_compass_campaigns.tenant_id,
            public.team_compass_campaigns.hr_group_id
          )
        )
        or (select internal_security.can_manage_employee(participation.employee_id, 'team-compass:read'))
      )
  )
);

create policy team_compass_campaigns_insert
on public.team_compass_campaigns for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'team-compass:manage')));

create policy team_compass_campaigns_update
on public.team_compass_campaigns for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'team-compass:manage')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'team-compass:manage')));

create policy team_compass_campaign_targets_select
on public.team_compass_campaign_targets for select to authenticated
using (exists (
  select 1 from public.team_compass_campaigns campaign
  where campaign.tenant_id = public.team_compass_campaign_targets.tenant_id
    and campaign.hr_group_id = public.team_compass_campaign_targets.hr_group_id
    and campaign.id = public.team_compass_campaign_targets.campaign_id
));

create policy team_compass_campaign_targets_insert
on public.team_compass_campaign_targets for insert to authenticated
with check (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'team-compass:manage'))
  and exists (
    select 1 from public.team_compass_campaigns campaign
    where campaign.tenant_id = public.team_compass_campaign_targets.tenant_id
      and campaign.hr_group_id = public.team_compass_campaign_targets.hr_group_id
      and campaign.id = public.team_compass_campaign_targets.campaign_id
      and campaign.status = 'DRAFT'
  )
);

create policy team_compass_campaign_targets_delete
on public.team_compass_campaign_targets for delete to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'team-compass:manage'))
  and exists (
    select 1 from public.team_compass_campaigns campaign
    where campaign.tenant_id = public.team_compass_campaign_targets.tenant_id
      and campaign.hr_group_id = public.team_compass_campaign_targets.hr_group_id
      and campaign.id = public.team_compass_campaign_targets.campaign_id
      and campaign.status = 'DRAFT'
  )
);

create policy team_compass_participations_select
on public.team_compass_participations for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'team-compass:manage'))
  or (
    employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'self:team-compass:read'))
  )
  or (select internal_security.can_manage_employee(employee_id, 'team-compass:read'))
);

create policy team_compass_answers_select
on public.team_compass_answers for select to authenticated
using (exists (
  select 1 from public.team_compass_participations participation
  where participation.tenant_id = public.team_compass_answers.tenant_id
    and participation.hr_group_id = public.team_compass_answers.hr_group_id
    and participation.id = public.team_compass_answers.participation_id
    and participation.employee_id = (
      select internal_security.current_employee_id(public.team_compass_answers.tenant_id, public.team_compass_answers.hr_group_id)
    )
    and (
      select internal_security.current_user_has_hr_group_permission(
        public.team_compass_answers.tenant_id,
        public.team_compass_answers.hr_group_id,
        'self:team-compass:read'
      )
    )
));

create policy team_compass_profiles_select
on public.team_compass_profiles for select to authenticated
using (exists (
  select 1 from public.team_compass_participations participation
  where participation.tenant_id = public.team_compass_profiles.tenant_id
    and participation.hr_group_id = public.team_compass_profiles.hr_group_id
    and participation.id = public.team_compass_profiles.participation_id
    and participation.employee_id = (
      select internal_security.current_employee_id(public.team_compass_profiles.tenant_id, public.team_compass_profiles.hr_group_id)
    )
    and (
      select internal_security.current_user_has_hr_group_permission(
        public.team_compass_profiles.tenant_id,
        public.team_compass_profiles.hr_group_id,
        'self:team-compass:read'
      )
    )
));

revoke all on public.team_compass_questionnaire_versions from public, anon, authenticated;
revoke all on public.team_compass_questions from public, anon, authenticated;
revoke all on public.team_compass_campaigns from public, anon, authenticated;
revoke all on public.team_compass_campaign_targets from public, anon, authenticated;
revoke all on public.team_compass_participations from public, anon, authenticated;
revoke all on public.team_compass_answers from public, anon, authenticated;
revoke all on public.team_compass_profiles from public, anon, authenticated;

grant select on public.team_compass_questionnaire_versions to authenticated;
grant select on public.team_compass_questions to authenticated;
grant select on public.team_compass_campaigns to authenticated;
grant select on public.team_compass_campaign_targets to authenticated;
grant select on public.team_compass_participations to authenticated;
grant select on public.team_compass_answers to authenticated;
grant select on public.team_compass_profiles to authenticated;

create or replace function public.save_team_compass_campaign(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_campaign_id uuid,
  requested_expected_version integer,
  requested_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_campaign public.team_compass_campaigns%rowtype;
  questionnaire_id uuid := (requested_payload ->> 'questionnaireVersionId')::uuid;
  department_ids uuid[];
begin
  if not internal_security.current_user_has_hr_group_permission(
    requested_tenant_id, requested_hr_group_id, 'team-compass:manage'
  ) then
    raise exception using errcode = '42501', message = 'TEAM_COMPASS_FORBIDDEN';
  end if;

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into department_ids
  from jsonb_array_elements_text(coalesce(requested_payload -> 'departmentIds', '[]'::jsonb)) value;

  if cardinality(department_ids) = 0
     or nullif(btrim(requested_payload ->> 'name'), '') is null
     or (requested_payload ->> 'endsOn')::date < (requested_payload ->> 'startsOn')::date
     or (requested_payload ->> 'anonymityThreshold')::integer not between 5 and 50
     or not exists (
       select 1 from public.team_compass_questionnaire_versions questionnaire
       where questionnaire.id = questionnaire_id and questionnaire.status = 'ACTIVE'
     )
     or (
       select count(*) from public.departments department
       where department.tenant_id = requested_tenant_id
         and department.hr_group_id = requested_hr_group_id
         and department.id = any(department_ids)
         and department.is_active
     ) <> cardinality(department_ids) then
    raise exception using errcode = '22023', message = 'TEAM_COMPASS_CAMPAIGN_INVALID';
  end if;

  if requested_campaign_id is null then
    insert into public.team_compass_campaigns (
      tenant_id, hr_group_id, questionnaire_version_id, name, description,
      personal_message, starts_on, ends_on, anonymity_threshold,
      created_by_user_id, updated_by_user_id
    ) values (
      requested_tenant_id, requested_hr_group_id, questionnaire_id,
      btrim(requested_payload ->> 'name'), nullif(btrim(requested_payload ->> 'description'), ''),
      nullif(btrim(requested_payload ->> 'personalMessage'), ''),
      (requested_payload ->> 'startsOn')::date, (requested_payload ->> 'endsOn')::date,
      (requested_payload ->> 'anonymityThreshold')::smallint, auth.uid(), auth.uid()
    ) returning * into saved_campaign;
  else
    select * into saved_campaign
    from public.team_compass_campaigns campaign
    where campaign.id = requested_campaign_id
      and campaign.tenant_id = requested_tenant_id
      and campaign.hr_group_id = requested_hr_group_id
    for update;
    if not found then raise exception using errcode = 'P0002', message = 'TEAM_COMPASS_CAMPAIGN_NOT_FOUND'; end if;
    if saved_campaign.status <> 'DRAFT' then
      raise exception using errcode = '55000', message = 'TEAM_COMPASS_CAMPAIGN_LOCKED';
    end if;
    if requested_expected_version is null or saved_campaign.version <> requested_expected_version then
      raise exception using errcode = '40001', message = 'TEAM_COMPASS_VERSION_CONFLICT';
    end if;

    update public.team_compass_campaigns
    set questionnaire_version_id = questionnaire_id,
        name = btrim(requested_payload ->> 'name'),
        description = nullif(btrim(requested_payload ->> 'description'), ''),
        personal_message = nullif(btrim(requested_payload ->> 'personalMessage'), ''),
        starts_on = (requested_payload ->> 'startsOn')::date,
        ends_on = (requested_payload ->> 'endsOn')::date,
        anonymity_threshold = (requested_payload ->> 'anonymityThreshold')::smallint,
        version = version + 1,
        updated_by_user_id = auth.uid()
    where id = saved_campaign.id
    returning * into saved_campaign;

    delete from public.team_compass_campaign_targets where campaign_id = saved_campaign.id;
  end if;

  insert into public.team_compass_campaign_targets (tenant_id, hr_group_id, campaign_id, department_id)
  select requested_tenant_id, requested_hr_group_id, saved_campaign.id, department_id
  from unnest(department_ids) department_id;

  return jsonb_build_object('campaignId', saved_campaign.id, 'version', saved_campaign.version);
end;
$$;

revoke all on function public.save_team_compass_campaign(uuid, uuid, uuid, integer, jsonb) from public, anon;
grant execute on function public.save_team_compass_campaign(uuid, uuid, uuid, integer, jsonb) to authenticated;

create or replace function public.start_team_compass_campaign(
  requested_campaign_id uuid,
  requested_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign_row public.team_compass_campaigns%rowtype;
  participant_count integer;
begin
  select * into campaign_row
  from public.team_compass_campaigns campaign
  where campaign.id = requested_campaign_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'TEAM_COMPASS_CAMPAIGN_NOT_FOUND';
  end if;
  if not internal_security.current_user_has_hr_group_permission(
    campaign_row.tenant_id, campaign_row.hr_group_id, 'team-compass:manage'
  ) then
    raise exception using errcode = '42501', message = 'TEAM_COMPASS_FORBIDDEN';
  end if;
  if campaign_row.status <> 'DRAFT' then
    raise exception using errcode = '55000', message = 'TEAM_COMPASS_CAMPAIGN_LOCKED';
  end if;
  if campaign_row.version <> requested_expected_version then
    raise exception using errcode = '40001', message = 'TEAM_COMPASS_VERSION_CONFLICT';
  end if;
  if campaign_row.ends_on < current_date then
    raise exception using errcode = '22023', message = 'TEAM_COMPASS_CAMPAIGN_DATE_INVALID';
  end if;
  if not exists (
    select 1 from public.team_compass_campaign_targets target
    join public.departments department
      on department.tenant_id = target.tenant_id
     and department.hr_group_id = target.hr_group_id
     and department.id = target.department_id
     and department.is_active
    where target.campaign_id = campaign_row.id
  ) then
    raise exception using errcode = '22023', message = 'TEAM_COMPASS_TARGET_REQUIRED';
  end if;

  insert into public.team_compass_participations (
    tenant_id, hr_group_id, campaign_id, employee_id, department_id
  )
  select campaign_row.tenant_id,
         campaign_row.hr_group_id,
         campaign_row.id,
         participant.employee_id,
         participant.department_id
  from (
    select distinct on (organization.employee_id)
           organization.employee_id,
           organization.department_id
    from public.employee_organizations organization
    join public.team_compass_campaign_targets target
      on target.tenant_id = organization.tenant_id
     and target.hr_group_id = organization.hr_group_id
     and target.campaign_id = campaign_row.id
     and target.department_id = organization.department_id
    join public.employees employee
      on employee.tenant_id = organization.tenant_id
     and employee.hr_group_id = organization.hr_group_id
     and employee.id = organization.employee_id
     and employee.deleted_at is null
     and employee.is_active
     and not employee.is_archived
    where organization.tenant_id = campaign_row.tenant_id
      and organization.hr_group_id = campaign_row.hr_group_id
      and organization.effective_from <= current_date
      and (organization.effective_to is null or organization.effective_to >= current_date)
    order by organization.employee_id, organization.effective_from desc, organization.department_id
  ) participant
  on conflict (tenant_id, hr_group_id, campaign_id, employee_id) do nothing;

  get diagnostics participant_count = row_count;
  if participant_count = 0 then
    raise exception using errcode = '22023', message = 'TEAM_COMPASS_NO_PARTICIPANTS';
  end if;

  update public.team_compass_campaigns
  set status = 'ACTIVE',
      started_at = timezone('utc', now()),
      version = version + 1,
      updated_by_user_id = auth.uid()
  where id = campaign_row.id;

  return jsonb_build_object('campaignId', campaign_row.id, 'participantCount', participant_count);
end;
$$;

revoke all on function public.start_team_compass_campaign(uuid, integer) from public, anon;
grant execute on function public.start_team_compass_campaign(uuid, integer) to authenticated;

create or replace function public.transition_team_compass_campaign(
  requested_campaign_id uuid,
  requested_expected_version integer,
  requested_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign_row public.team_compass_campaigns%rowtype;
begin
  select * into campaign_row from public.team_compass_campaigns where id = requested_campaign_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'TEAM_COMPASS_CAMPAIGN_NOT_FOUND'; end if;
  if not internal_security.current_user_has_hr_group_permission(campaign_row.tenant_id, campaign_row.hr_group_id, 'team-compass:manage') then
    raise exception using errcode = '42501', message = 'TEAM_COMPASS_FORBIDDEN';
  end if;
  if campaign_row.version <> requested_expected_version then
    raise exception using errcode = '40001', message = 'TEAM_COMPASS_VERSION_CONFLICT';
  end if;
  if requested_status = 'CLOSED' and campaign_row.status <> 'ACTIVE' then
    raise exception using errcode = '55000', message = 'TEAM_COMPASS_CAMPAIGN_LOCKED';
  elsif requested_status = 'ARCHIVED' and campaign_row.status <> 'CLOSED' then
    raise exception using errcode = '55000', message = 'TEAM_COMPASS_CAMPAIGN_LOCKED';
  elsif requested_status not in ('CLOSED', 'ARCHIVED') then
    raise exception using errcode = '22023', message = 'TEAM_COMPASS_STATUS_INVALID';
  end if;

  update public.team_compass_campaigns
  set status = requested_status,
      closed_at = case when requested_status = 'CLOSED' then timezone('utc', now()) else closed_at end,
      archived_at = case when requested_status = 'ARCHIVED' then timezone('utc', now()) else archived_at end,
      version = version + 1,
      updated_by_user_id = auth.uid()
  where id = campaign_row.id;
  return campaign_row.id;
end;
$$;

revoke all on function public.transition_team_compass_campaign(uuid, integer, text) from public, anon;
grant execute on function public.transition_team_compass_campaign(uuid, integer, text) to authenticated;

create or replace function public.save_team_compass_response(
  requested_participation_id uuid,
  requested_expected_version integer,
  requested_answers jsonb,
  requested_submit boolean,
  requested_share_outer boolean default false,
  requested_share_inner boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  participation_row public.team_compass_participations%rowtype;
  campaign_row public.team_compass_campaigns%rowtype;
  actor_employee_id uuid;
  supplied_count integer;
  distinct_count integer;
  answer_count integer;
  inner_action numeric; inner_vision numeric; inner_harmony numeric; inner_logic numeric;
  outer_action numeric; outer_vision numeric; outer_harmony numeric; outer_logic numeric;
  inner_x numeric; inner_y numeric; outer_x numeric; outer_y numeric; shift_distance numeric;
  primary_dimension text; secondary_dimension text; shift_band text;
begin
  select * into participation_row
  from public.team_compass_participations participation
  where participation.id = requested_participation_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'TEAM_COMPASS_PARTICIPATION_NOT_FOUND'; end if;

  select * into campaign_row from public.team_compass_campaigns where id = participation_row.campaign_id;
  actor_employee_id := internal_security.current_employee_id(participation_row.tenant_id, participation_row.hr_group_id);
  if actor_employee_id is null
     or actor_employee_id <> participation_row.employee_id
     or not internal_security.current_user_has_hr_group_permission(
       participation_row.tenant_id, participation_row.hr_group_id, 'self:team-compass:write'
     ) then
    raise exception using errcode = '42501', message = 'TEAM_COMPASS_FORBIDDEN';
  end if;
  if campaign_row.status <> 'ACTIVE' or campaign_row.ends_on < current_date then
    raise exception using errcode = '55000', message = 'TEAM_COMPASS_CAMPAIGN_LOCKED';
  end if;
  if participation_row.status in ('COMPLETED', 'DECLINED') then
    raise exception using errcode = '55000', message = 'TEAM_COMPASS_RESPONSE_LOCKED';
  end if;
  if participation_row.version <> requested_expected_version then
    raise exception using errcode = '40001', message = 'TEAM_COMPASS_VERSION_CONFLICT';
  end if;
  if requested_share_inner and not requested_share_outer then
    raise exception using errcode = '22023', message = 'TEAM_COMPASS_INNER_SHARING_REQUIRES_OUTER';
  end if;
  if jsonb_typeof(requested_answers) <> 'array' then
    raise exception using errcode = '22023', message = 'TEAM_COMPASS_ANSWERS_INVALID';
  end if;

  with supplied as (
    select answer.question_id, answer.inner_score, answer.outer_score
    from jsonb_to_recordset(requested_answers) as answer(question_id uuid, inner_score smallint, outer_score smallint)
  )
  select count(*), count(distinct question_id)
  into supplied_count, distinct_count
  from supplied
  where inner_score between 1 and 5 and outer_score between 1 and 5;

  if supplied_count = 0 or supplied_count <> distinct_count
     or supplied_count <> jsonb_array_length(requested_answers) then
    raise exception using errcode = '22023', message = 'TEAM_COMPASS_ANSWERS_INVALID';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(requested_answers) as answer(question_id uuid, inner_score smallint, outer_score smallint)
    left join public.team_compass_questions question
      on question.id = answer.question_id
     and question.questionnaire_version_id = campaign_row.questionnaire_version_id
    where question.id is null
  ) then
    raise exception using errcode = '22023', message = 'TEAM_COMPASS_QUESTION_INVALID';
  end if;

  insert into public.team_compass_answers (
    tenant_id, hr_group_id, participation_id, question_id, inner_score, outer_score
  )
  select participation_row.tenant_id,
         participation_row.hr_group_id,
         participation_row.id,
         answer.question_id,
         answer.inner_score,
         answer.outer_score
  from jsonb_to_recordset(requested_answers) as answer(question_id uuid, inner_score smallint, outer_score smallint)
  on conflict (participation_id, question_id) do update
  set inner_score = excluded.inner_score,
      outer_score = excluded.outer_score,
      updated_at = timezone('utc', now());

  if requested_submit then
    select count(*) into answer_count
    from public.team_compass_answers answer
    join public.team_compass_questions question
      on question.id = answer.question_id
     and question.questionnaire_version_id = campaign_row.questionnaire_version_id
    where answer.participation_id = participation_row.id;
    if answer_count <> 40 then
      raise exception using errcode = '22023', message = 'TEAM_COMPASS_ANSWERS_INCOMPLETE';
    end if;

    select
      round((((sum(answer.inner_score) filter (where question.dimension = 'ACTION')) - 10) / 40.0 * 100)::numeric, 2),
      round((((sum(answer.inner_score) filter (where question.dimension = 'VISION')) - 10) / 40.0 * 100)::numeric, 2),
      round((((sum(answer.inner_score) filter (where question.dimension = 'HARMONY')) - 10) / 40.0 * 100)::numeric, 2),
      round((((sum(answer.inner_score) filter (where question.dimension = 'LOGIC')) - 10) / 40.0 * 100)::numeric, 2),
      round((((sum(answer.outer_score) filter (where question.dimension = 'ACTION')) - 10) / 40.0 * 100)::numeric, 2),
      round((((sum(answer.outer_score) filter (where question.dimension = 'VISION')) - 10) / 40.0 * 100)::numeric, 2),
      round((((sum(answer.outer_score) filter (where question.dimension = 'HARMONY')) - 10) / 40.0 * 100)::numeric, 2),
      round((((sum(answer.outer_score) filter (where question.dimension = 'LOGIC')) - 10) / 40.0 * 100)::numeric, 2)
    into inner_action, inner_vision, inner_harmony, inner_logic,
         outer_action, outer_vision, outer_harmony, outer_logic
    from public.team_compass_answers answer
    join public.team_compass_questions question on question.id = answer.question_id
    where answer.participation_id = participation_row.id;

    inner_x := round((((inner_action + inner_vision) - (inner_logic + inner_harmony)) / 2)::numeric, 2);
    inner_y := round((((inner_action + inner_logic) - (inner_vision + inner_harmony)) / 2)::numeric, 2);
    outer_x := round((((outer_action + outer_vision) - (outer_logic + outer_harmony)) / 2)::numeric, 2);
    outer_y := round((((outer_action + outer_logic) - (outer_vision + outer_harmony)) / 2)::numeric, 2);
    shift_distance := round(sqrt(power(outer_x - inner_x, 2) + power(outer_y - inner_y, 2))::numeric, 2);
    shift_band := case when shift_distance < 15 then 'LOW' when shift_distance <= 35 then 'MEDIUM' else 'HIGH' end;

    select ranked.dimension into primary_dimension
    from (values
      ('ACTION', inner_action, 1), ('VISION', inner_vision, 2),
      ('HARMONY', inner_harmony, 3), ('LOGIC', inner_logic, 4)
    ) ranked(dimension, score, stable_order)
    order by score desc, stable_order
    limit 1;
    select ranked.dimension into secondary_dimension
    from (values
      ('ACTION', inner_action, 1), ('VISION', inner_vision, 2),
      ('HARMONY', inner_harmony, 3), ('LOGIC', inner_logic, 4)
    ) ranked(dimension, score, stable_order)
    order by score desc, stable_order
    offset 1 limit 1;

    insert into public.team_compass_profiles (
      tenant_id, hr_group_id, participation_id,
      inner_action, inner_vision, inner_harmony, inner_logic,
      outer_action, outer_vision, outer_harmony, outer_logic,
      inner_x, inner_y, outer_x, outer_y, shift_distance, shift_band,
      primary_dimension, secondary_dimension
    ) values (
      participation_row.tenant_id, participation_row.hr_group_id, participation_row.id,
      inner_action, inner_vision, inner_harmony, inner_logic,
      outer_action, outer_vision, outer_harmony, outer_logic,
      inner_x, inner_y, outer_x, outer_y, shift_distance, shift_band,
      primary_dimension, secondary_dimension
    )
    on conflict (participation_id) do update set
      inner_action = excluded.inner_action,
      inner_vision = excluded.inner_vision,
      inner_harmony = excluded.inner_harmony,
      inner_logic = excluded.inner_logic,
      outer_action = excluded.outer_action,
      outer_vision = excluded.outer_vision,
      outer_harmony = excluded.outer_harmony,
      outer_logic = excluded.outer_logic,
      inner_x = excluded.inner_x,
      inner_y = excluded.inner_y,
      outer_x = excluded.outer_x,
      outer_y = excluded.outer_y,
      shift_distance = excluded.shift_distance,
      shift_band = excluded.shift_band,
      primary_dimension = excluded.primary_dimension,
      secondary_dimension = excluded.secondary_dimension,
      calculated_at = timezone('utc', now());
  end if;

  update public.team_compass_participations
  set status = case when requested_submit then 'COMPLETED' else 'IN_PROGRESS' end,
      started_at = coalesce(started_at, timezone('utc', now())),
      completed_at = case when requested_submit then timezone('utc', now()) else completed_at end,
      share_outer_profile = case when requested_submit then requested_share_outer else share_outer_profile end,
      share_inner_profile = case when requested_submit then requested_share_inner else share_inner_profile end,
      version = version + 1
  where id = participation_row.id;

  return jsonb_build_object(
    'participationId', participation_row.id,
    'status', case when requested_submit then 'COMPLETED' else 'IN_PROGRESS' end,
    'version', participation_row.version + 1
  );
end;
$$;

revoke all on function public.save_team_compass_response(uuid, integer, jsonb, boolean, boolean, boolean) from public, anon;
grant execute on function public.save_team_compass_response(uuid, integer, jsonb, boolean, boolean, boolean) to authenticated;

create or replace function public.get_team_compass_team_projection(
  requested_campaign_id uuid,
  requested_department_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  campaign_row public.team_compass_campaigns%rowtype;
  can_manage boolean;
  completed_count integer;
  invited_count integer;
  average_action numeric; average_vision numeric; average_harmony numeric; average_logic numeric;
  named_profiles jsonb;
begin
  select * into campaign_row from public.team_compass_campaigns where id = requested_campaign_id;
  if not found then raise exception using errcode = 'P0002', message = 'TEAM_COMPASS_CAMPAIGN_NOT_FOUND'; end if;
  can_manage := internal_security.current_user_has_hr_group_permission(
    campaign_row.tenant_id, campaign_row.hr_group_id, 'team-compass:manage'
  );
  if not can_manage and not exists (
    select 1 from public.team_compass_participations participation
    where participation.campaign_id = campaign_row.id
      and (requested_department_id is null or participation.department_id = requested_department_id)
      and internal_security.can_manage_employee(participation.employee_id, 'team-compass:read')
  ) then
    raise exception using errcode = '42501', message = 'TEAM_COMPASS_FORBIDDEN';
  end if;

  with scoped as (
    select participation.*
    from public.team_compass_participations participation
    where participation.campaign_id = campaign_row.id
      and (requested_department_id is null or participation.department_id = requested_department_id)
      and (can_manage or internal_security.can_manage_employee(participation.employee_id, 'team-compass:read'))
  )
  select count(*), count(*) filter (where status = 'COMPLETED')
  into invited_count, completed_count
  from scoped;

  if completed_count < campaign_row.anonymity_threshold then
    return jsonb_build_object(
      'available', false,
      'invitedCount', invited_count,
      'completedCount', completed_count,
      'threshold', campaign_row.anonymity_threshold
    );
  end if;

  with scoped as (
    select participation.*
    from public.team_compass_participations participation
    where participation.campaign_id = campaign_row.id
      and participation.status = 'COMPLETED'
      and (requested_department_id is null or participation.department_id = requested_department_id)
      and (can_manage or internal_security.can_manage_employee(participation.employee_id, 'team-compass:read'))
  )
  select round(avg(profile.outer_action), 2),
         round(avg(profile.outer_vision), 2),
         round(avg(profile.outer_harmony), 2),
         round(avg(profile.outer_logic), 2)
  into average_action, average_vision, average_harmony, average_logic
  from scoped
  join public.team_compass_profiles profile on profile.participation_id = scoped.id;

  with scoped as (
    select participation.*
    from public.team_compass_participations participation
    where participation.campaign_id = campaign_row.id
      and participation.status = 'COMPLETED'
      and participation.share_outer_profile
      and (requested_department_id is null or participation.department_id = requested_department_id)
      and (can_manage or internal_security.can_manage_employee(participation.employee_id, 'team-compass:read'))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'employeeId', employee.id,
    'label', nullif(btrim(concat_ws(' ', employee.first_name, employee.birth_name)), ''),
    'outer', jsonb_build_object('x', profile.outer_x, 'y', profile.outer_y),
    'inner', case when scoped.share_inner_profile then jsonb_build_object('x', profile.inner_x, 'y', profile.inner_y) else null end,
    'primaryDimension', profile.primary_dimension
  ) order by employee.first_name, employee.birth_name), '[]'::jsonb)
  into named_profiles
  from scoped
  join public.team_compass_profiles profile on profile.participation_id = scoped.id
  join public.employees employee
    on employee.tenant_id = scoped.tenant_id
   and employee.hr_group_id = scoped.hr_group_id
   and employee.id = scoped.employee_id;

  return jsonb_build_object(
    'available', true,
    'invitedCount', invited_count,
    'completedCount', completed_count,
    'threshold', campaign_row.anonymity_threshold,
    'outerPercentages', jsonb_build_object(
      'ACTION', average_action,
      'VISION', average_vision,
      'HARMONY', average_harmony,
      'LOGIC', average_logic
    ),
    'namedProfiles', named_profiles
  );
end;
$$;

revoke all on function public.get_team_compass_team_projection(uuid, uuid) from public, anon;
grant execute on function public.get_team_compass_team_projection(uuid, uuid) to authenticated;

insert into public.team_compass_questionnaire_versions (
  id, code, version, name_nl, name_en, status
) values (
  md5('team-compass:collaboration:v1')::uuid,
  'TEAM_COMPASS_COLLABORATION',
  1,
  'Teamkompas samenwerking',
  'Team Compass collaboration',
  'ACTIVE'
);

insert into public.team_compass_questions (
  id, questionnaire_version_id, code, dimension, prompt_nl, prompt_en, sort_order
) values
  (md5('team-compass:v1:q01')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q01', 'ACTION', 'Ik neem snel beslissingen, ook bij onvolledige informatie.', 'I make decisions quickly, even when information is incomplete.', 1),
  (md5('team-compass:v1:q02')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q02', 'ACTION', 'Ik stuur direct op resultaten en het behalen van doelen.', 'I focus directly on results and achieving goals.', 2),
  (md5('team-compass:v1:q03')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q03', 'ACTION', 'Ik neem van nature de leiding in een groep.', 'I naturally take the lead in a group.', 3),
  (md5('team-compass:v1:q04')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q04', 'ACTION', 'Ik ben direct en spreek zaken uit als dat nodig is.', 'I am direct and speak up when needed.', 4),
  (md5('team-compass:v1:q05')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q05', 'ACTION', 'Ik houd van competitie en een hoog tempo.', 'I enjoy competition and a fast pace.', 5),
  (md5('team-compass:v1:q06')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q06', 'ACTION', 'Ik richt me liever op de grote lijnen dan op details.', 'I prefer focusing on the big picture rather than details.', 6),
  (md5('team-compass:v1:q07')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q07', 'ACTION', 'Ik neem graag verantwoorde risico’s om vooruitgang te boeken.', 'I like taking considered risks to make progress.', 7),
  (md5('team-compass:v1:q08')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q08', 'ACTION', 'Ik blijf zakelijk wanneer emoties oplopen.', 'I stay businesslike when emotions run high.', 8),
  (md5('team-compass:v1:q09')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q09', 'ACTION', 'Ik verwacht daadkracht van mezelf en mijn omgeving.', 'I expect decisiveness from myself and those around me.', 9),
  (md5('team-compass:v1:q10')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q10', 'ACTION', 'Ik neem de leiding bij onverwachte situaties.', 'I take the lead in unexpected situations.', 10),
  (md5('team-compass:v1:q11')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q11', 'VISION', 'Ik bedenk snel vernieuwende en creatieve ideeën.', 'I quickly generate innovative and creative ideas.', 11),
  (md5('team-compass:v1:q12')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q12', 'VISION', 'Ik leg gemakkelijk contact met nieuwe mensen.', 'I connect easily with new people.', 12),
  (md5('team-compass:v1:q13')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q13', 'VISION', 'Ik weet anderen enthousiast te maken voor een idee.', 'I can get others excited about an idea.', 13),
  (md5('team-compass:v1:q14')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q14', 'VISION', 'Ik vind werkplezier en sfeer belangrijk.', 'I value enjoyment and atmosphere at work.', 14),
  (md5('team-compass:v1:q15')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q15', 'VISION', 'Ik ben flexibel en improviseer gemakkelijk.', 'I am flexible and improvise easily.', 15),
  (md5('team-compass:v1:q16')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q16', 'VISION', 'Ik druk me levendig uit in gesprekken.', 'I express myself vividly in conversations.', 16),
  (md5('team-compass:v1:q17')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q17', 'VISION', 'Ik zoek actief samenwerking en nieuwe contacten op.', 'I actively seek collaboration and new connections.', 17),
  (md5('team-compass:v1:q18')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q18', 'VISION', 'Ik werk graag in een dynamische, veranderende omgeving.', 'I enjoy working in a dynamic, changing environment.', 18),
  (md5('team-compass:v1:q19')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q19', 'VISION', 'Ik motiveer mensen vanuit optimisme en energie.', 'I motivate people with optimism and energy.', 19),
  (md5('team-compass:v1:q20')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q20', 'VISION', 'Ik houd van brainstormen voordat beperkingen worden aangebracht.', 'I enjoy brainstorming before constraints are introduced.', 20),
  (md5('team-compass:v1:q21')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q21', 'HARMONY', 'Ik luister geduldig en bied een luisterend oor.', 'I listen patiently and give people my full attention.', 21),
  (md5('team-compass:v1:q22')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q22', 'HARMONY', 'Ik hecht veel waarde aan loyaliteit en onderling vertrouwen.', 'I place great value on loyalty and mutual trust.', 22),
  (md5('team-compass:v1:q23')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q23', 'HARMONY', 'Ik werk het liefst in een rustige, voorspelbare omgeving.', 'I prefer working in a calm, predictable environment.', 23),
  (md5('team-compass:v1:q24')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q24', 'HARMONY', 'Ik zoek naar oplossingen waarin mensen zich kunnen vinden.', 'I look for solutions people can support.', 24),
  (md5('team-compass:v1:q25')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q25', 'HARMONY', 'Ik neem de tijd om collega’s goed te ondersteunen.', 'I take time to support colleagues well.', 25),
  (md5('team-compass:v1:q26')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q26', 'HARMONY', 'Ik vermijd liever openlijke conflicten op het werk.', 'I prefer to avoid open conflict at work.', 26),
  (md5('team-compass:v1:q27')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q27', 'HARMONY', 'Ik verander plannen liever na zorgvuldige afstemming.', 'I prefer changing plans after careful consultation.', 27),
  (md5('team-compass:v1:q28')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q28', 'HARMONY', 'Ik zorg ervoor dat iedereen in het team wordt gehoord.', 'I make sure everyone on the team is heard.', 28),
  (md5('team-compass:v1:q29')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q29', 'HARMONY', 'Ik ben trouw aan afspraken en een constante factor.', 'I keep commitments and provide consistency.', 29),
  (md5('team-compass:v1:q30')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q30', 'HARMONY', 'Ik zet mijn eigen belang soms opzij voor het team.', 'I sometimes put my own interests aside for the team.', 30),
  (md5('team-compass:v1:q31')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q31', 'LOGIC', 'Ik controleer mijn werk grondig op feiten en nauwkeurigheid.', 'I thoroughly check my work for facts and accuracy.', 31),
  (md5('team-compass:v1:q32')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q32', 'LOGIC', 'Ik werk gestructureerd en volgens duidelijke afspraken.', 'I work in a structured way and follow clear agreements.', 32),
  (md5('team-compass:v1:q33')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q33', 'LOGIC', 'Ik baseer mijn oordeel op data, feiten en logica.', 'I base my judgment on data, facts and logic.', 33),
  (md5('team-compass:v1:q34')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q34', 'LOGIC', 'Ik neem de tijd om situaties eerst diepgaand te analyseren.', 'I take time to analyse situations thoroughly first.', 34),
  (md5('team-compass:v1:q35')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q35', 'LOGIC', 'Ik stel hoge kwaliteitseisen aan mezelf en anderen.', 'I set high quality standards for myself and others.', 35),
  (md5('team-compass:v1:q36')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q36', 'LOGIC', 'Ik houd van orde, overzicht en een heldere planning.', 'I value order, clarity and a clear plan.', 36),
  (md5('team-compass:v1:q37')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q37', 'LOGIC', 'Ik bewaak regels, standaarden en procedures.', 'I safeguard rules, standards and procedures.', 37),
  (md5('team-compass:v1:q38')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q38', 'LOGIC', 'Ik stel kritische, verdiepende vragen bij plannen.', 'I ask critical, in-depth questions about plans.', 38),
  (md5('team-compass:v1:q39')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q39', 'LOGIC', 'Ik werk graag zelfstandig wanneer kwaliteit centraal staat.', 'I like working independently when quality is paramount.', 39),
  (md5('team-compass:v1:q40')::uuid, md5('team-compass:collaboration:v1')::uuid, 'Q40', 'LOGIC', 'Ik scheid emotie en zakelijke afwegingen zorgvuldig.', 'I carefully separate emotion from business considerations.', 40);
