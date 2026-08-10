begin;

insert into public.permissions (code, name, category, description)
values
  ('research:read', 'Onderzoeken monitoren', 'MEDEWERKERSONDERZOEK', 'Survey- en eNPS-campagnes en deelnamevoortgang monitoren'),
  ('research:write', 'Onderzoeken beheren', 'MEDEWERKERSONDERZOEK', 'Surveys, eNPS-campagnes, vragen en doelgroepen beheren'),
  ('research-result:read', 'Onderzoeksresultaten bekijken', 'MEDEWERKERSONDERZOEK', 'Surveyresultaten en geanonimiseerde eNPS-resultaten bekijken'),
  ('self:research:respond', 'Onderzoeken invullen', 'MEDEWERKERSONDERZOEK', 'Eigen survey- en eNPS-uitnodigingen invullen')
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where (
  role.code = 'TENANT_ADMIN'
  and permission.code in ('research:read', 'research:write', 'research-result:read')
) or (
  role.code = 'EMPLOYEE'
  and role.tenant_id is null
  and permission.code = 'self:research:respond'
)
on conflict do nothing;

create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hr_group_id uuid not null,
  title text not null check (char_length(btrim(title)) between 3 and 255),
  description text not null default '' check (char_length(description) <= 5000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_anonymous boolean not null default true,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'CLOSED')),
  target_mode text not null check (target_mode in ('ALL', 'DEPARTMENTS', 'LOCATIONS', 'ENTITIES', 'EMPLOYEES')),
  target_ids uuid[] not null default '{}',
  created_by uuid not null references auth.users(id) on delete restrict,
  activated_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint surveys_window_check check (ends_at > starts_at),
  constraint surveys_target_check check (
    (target_mode = 'ALL' and cardinality(target_ids) = 0)
    or (target_mode <> 'ALL' and cardinality(target_ids) > 0)
  ),
  constraint surveys_hr_group_fkey foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete cascade,
  unique (tenant_id, hr_group_id, id)
);

create table public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  survey_id uuid not null,
  question_text text not null check (char_length(btrim(question_text)) between 2 and 2000),
  question_type text not null check (question_type in ('TEXT_SINGLE', 'TEXT_MULTI', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'NUMBER', 'DATE', 'DATETIME', 'MATRIX')),
  is_required boolean not null default false,
  order_index integer not null check (order_index >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint survey_questions_survey_fkey foreign key (tenant_id, hr_group_id, survey_id)
    references public.surveys(tenant_id, hr_group_id, id) on delete cascade,
  unique (survey_id, order_index),
  unique (tenant_id, hr_group_id, survey_id, id)
);

create table public.survey_question_options (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  survey_id uuid not null,
  question_id uuid not null,
  option_label text not null check (char_length(btrim(option_label)) between 1 and 255),
  order_index integer not null check (order_index >= 0),
  constraint survey_question_options_question_fkey foreign key (tenant_id, hr_group_id, survey_id, question_id)
    references public.survey_questions(tenant_id, hr_group_id, survey_id, id) on delete cascade,
  unique (question_id, order_index),
  unique (question_id, id)
);

create table public.survey_matrix_rows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  survey_id uuid not null,
  question_id uuid not null,
  row_label text not null check (char_length(btrim(row_label)) between 1 and 255),
  is_required boolean not null default false,
  order_index integer not null check (order_index >= 0),
  constraint survey_matrix_rows_question_fkey foreign key (tenant_id, hr_group_id, survey_id, question_id)
    references public.survey_questions(tenant_id, hr_group_id, survey_id, id) on delete cascade,
  unique (question_id, order_index),
  unique (question_id, id)
);

create table public.survey_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  survey_id uuid not null,
  employee_id uuid not null,
  has_submitted boolean not null default false,
  submitted_at timestamptz,
  reminder_count integer not null default 0 check (reminder_count >= 0),
  last_reminded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint survey_invitations_survey_fkey foreign key (tenant_id, hr_group_id, survey_id)
    references public.surveys(tenant_id, hr_group_id, id) on delete cascade,
  constraint survey_invitations_employee_fkey foreign key (tenant_id, hr_group_id, employee_id)
    references public.employees(tenant_id, hr_group_id, id) on delete cascade,
  unique (survey_id, employee_id),
  unique (tenant_id, hr_group_id, survey_id, id)
);

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  survey_id uuid not null,
  respondent_employee_id uuid,
  submitted_at timestamptz not null default timezone('utc', now()),
  constraint survey_responses_survey_fkey foreign key (tenant_id, hr_group_id, survey_id)
    references public.surveys(tenant_id, hr_group_id, id) on delete cascade,
  constraint survey_responses_employee_fkey foreign key (tenant_id, hr_group_id, respondent_employee_id)
    references public.employees(tenant_id, hr_group_id, id) on delete set null,
  unique (tenant_id, hr_group_id, survey_id, id)
);

create table public.survey_answers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  survey_id uuid not null,
  response_id uuid not null,
  question_id uuid not null,
  matrix_row_id uuid,
  option_id uuid,
  answer_text text,
  constraint survey_answers_response_fkey foreign key (tenant_id, hr_group_id, survey_id, response_id)
    references public.survey_responses(tenant_id, hr_group_id, survey_id, id) on delete cascade,
  constraint survey_answers_question_fkey foreign key (tenant_id, hr_group_id, survey_id, question_id)
    references public.survey_questions(tenant_id, hr_group_id, survey_id, id) on delete cascade,
  constraint survey_answers_matrix_row_fkey foreign key (question_id, matrix_row_id)
    references public.survey_matrix_rows(question_id, id) on delete cascade,
  constraint survey_answers_option_fkey foreign key (question_id, option_id)
    references public.survey_question_options(question_id, id) on delete cascade,
  constraint survey_answers_value_check check (option_id is not null or answer_text is not null)
);

create table public.enps_question_bank_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  hr_group_id uuid,
  name text not null,
  order_index integer not null check (order_index between 1 and 1000),
  is_system boolean not null default false,
  constraint enps_question_bank_categories_scope_check check (
    (is_system and tenant_id is null and hr_group_id is null)
    or (not is_system and tenant_id is not null and hr_group_id is not null)
  ),
  constraint enps_question_bank_categories_hr_group_fkey foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete cascade
);

create unique index enps_question_bank_categories_system_name_idx
  on public.enps_question_bank_categories (lower(name)) where is_system;
create unique index enps_question_bank_categories_system_order_idx
  on public.enps_question_bank_categories (order_index) where is_system;
create unique index enps_question_bank_categories_scope_name_idx
  on public.enps_question_bank_categories (tenant_id, hr_group_id, lower(name)) where not is_system;

create table public.enps_question_bank (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  hr_group_id uuid,
  category_id uuid not null references public.enps_question_bank_categories(id) on delete restrict,
  question_number integer check (question_number between 1 and 150),
  question_text text not null check (char_length(btrim(question_text)) >= 2),
  default_type text not null check (default_type in ('SCALE_10', 'LIKERT_5', 'LIKERT_4', 'OPEN_TEXT', 'YES_NO')),
  is_mandatory_enps boolean not null default false,
  is_system boolean not null default false,
  constraint enps_question_bank_scope_check check (
    (is_system and tenant_id is null and hr_group_id is null and question_number is not null)
    or (not is_system and tenant_id is not null and hr_group_id is not null and question_number is null and not is_mandatory_enps)
  ),
  constraint enps_question_bank_hr_group_fkey foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete cascade
);

create unique index enps_question_bank_system_number_idx
  on public.enps_question_bank (question_number) where is_system;
create unique index enps_question_bank_system_text_idx
  on public.enps_question_bank (category_id, lower(question_text)) where is_system;
create unique index enps_question_bank_scope_text_idx
  on public.enps_question_bank (tenant_id, hr_group_id, category_id, lower(question_text)) where not is_system;

create or replace function internal_security.validate_enps_question_bank_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  category public.enps_question_bank_categories%rowtype;
begin
  select * into category
  from public.enps_question_bank_categories
  where id = new.category_id;

  if category.id is null
     or (new.is_system and not category.is_system)
     or (not new.is_system and not category.is_system and (
       category.tenant_id <> new.tenant_id or category.hr_group_id <> new.hr_group_id
     )) then
    raise exception 'ENPS_BANK_CATEGORY_SCOPE_INVALID' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger validate_enps_question_bank_scope
before insert or update of tenant_id, hr_group_id, category_id, is_system on public.enps_question_bank
for each row execute function internal_security.validate_enps_question_bank_scope();

create table public.enps_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hr_group_id uuid not null,
  title text not null check (char_length(btrim(title)) between 3 and 255),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  scale_type text not null default 'LIKERT_5' check (scale_type in ('LIKERT_5', 'LIKERT_4', 'SCALE_10')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'CLOSED')),
  target_mode text not null check (target_mode in ('ALL', 'DEPARTMENTS', 'LOCATIONS', 'ENTITIES', 'EMPLOYEES')),
  target_ids uuid[] not null default '{}',
  reminder_interval_days integer not null default 7 check (reminder_interval_days between 1 and 30),
  created_by uuid not null references auth.users(id) on delete restrict,
  activated_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint enps_campaigns_window_check check (ends_at > starts_at),
  constraint enps_campaigns_target_check check (
    (target_mode = 'ALL' and cardinality(target_ids) = 0)
    or (target_mode <> 'ALL' and cardinality(target_ids) > 0)
  ),
  constraint enps_campaigns_hr_group_fkey foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete cascade,
  unique (tenant_id, hr_group_id, id)
);

create table public.enps_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  campaign_id uuid not null,
  bank_question_id uuid references public.enps_question_bank(id) on delete restrict,
  category_name text not null,
  question_text text not null,
  question_type text not null check (question_type in ('SCALE_10', 'LIKERT_5', 'LIKERT_4', 'OPEN_TEXT', 'YES_NO')),
  is_mandatory boolean not null default false,
  is_enabled boolean not null default true,
  order_index integer not null check (order_index between 1 and 150),
  constraint enps_questions_campaign_fkey foreign key (tenant_id, hr_group_id, campaign_id)
    references public.enps_campaigns(tenant_id, hr_group_id, id) on delete cascade,
  unique (campaign_id, order_index),
  unique (campaign_id, bank_question_id),
  unique (tenant_id, hr_group_id, campaign_id, id)
);

create unique index enps_campaign_mandatory_question_idx
on public.enps_questions (campaign_id)
where is_mandatory;

create table public.enps_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  campaign_id uuid not null,
  employee_id uuid not null,
  has_submitted boolean not null default false,
  reminder_count integer not null default 0 check (reminder_count >= 0),
  last_reminded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint enps_invitations_campaign_fkey foreign key (tenant_id, hr_group_id, campaign_id)
    references public.enps_campaigns(tenant_id, hr_group_id, id) on delete cascade,
  constraint enps_invitations_employee_fkey foreign key (tenant_id, hr_group_id, employee_id)
    references public.employees(tenant_id, hr_group_id, id) on delete cascade,
  unique (campaign_id, employee_id),
  unique (tenant_id, hr_group_id, campaign_id, id)
);

create table public.enps_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  campaign_id uuid not null,
  submitted_at timestamptz not null default timezone('utc', now()),
  constraint enps_responses_campaign_fkey foreign key (tenant_id, hr_group_id, campaign_id)
    references public.enps_campaigns(tenant_id, hr_group_id, id) on delete cascade,
  unique (tenant_id, hr_group_id, campaign_id, id)
);

create table public.enps_answers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  campaign_id uuid not null,
  response_id uuid not null,
  question_id uuid not null,
  answer_value text not null check (char_length(answer_value) <= 10000),
  constraint enps_answers_response_fkey foreign key (tenant_id, hr_group_id, campaign_id, response_id)
    references public.enps_responses(tenant_id, hr_group_id, campaign_id, id) on delete cascade,
  constraint enps_answers_question_fkey foreign key (tenant_id, hr_group_id, campaign_id, question_id)
    references public.enps_questions(tenant_id, hr_group_id, campaign_id, id) on delete cascade,
  unique (response_id, question_id)
);

create index surveys_group_status_idx on public.surveys (tenant_id, hr_group_id, status, starts_at, ends_at);
create index survey_questions_survey_idx on public.survey_questions (survey_id, order_index);
create index survey_question_options_question_idx on public.survey_question_options (question_id, order_index);
create index survey_matrix_rows_question_idx on public.survey_matrix_rows (question_id, order_index);
create index survey_invitations_employee_idx on public.survey_invitations (tenant_id, hr_group_id, employee_id, has_submitted);
create index survey_responses_survey_idx on public.survey_responses (survey_id, submitted_at);
create index survey_responses_employee_idx on public.survey_responses (respondent_employee_id) where respondent_employee_id is not null;
create index survey_answers_response_idx on public.survey_answers (response_id, question_id);
create index survey_answers_question_idx on public.survey_answers (question_id, option_id, matrix_row_id);
create index enps_question_bank_category_idx on public.enps_question_bank (category_id, question_number);
create index enps_campaigns_group_status_idx on public.enps_campaigns (tenant_id, hr_group_id, status, starts_at, ends_at);
create index enps_questions_campaign_idx on public.enps_questions (campaign_id, order_index) where is_enabled;
create index enps_invitations_employee_idx on public.enps_invitations (tenant_id, hr_group_id, employee_id, has_submitted);
create index enps_responses_campaign_idx on public.enps_responses (campaign_id, submitted_at);
create index enps_answers_question_idx on public.enps_answers (question_id, answer_value);

create trigger set_surveys_updated_at before update on public.surveys
for each row execute function internal_security.set_updated_at();
create trigger set_survey_questions_updated_at before update on public.survey_questions
for each row execute function internal_security.set_updated_at();
create trigger set_enps_campaigns_updated_at before update on public.enps_campaigns
for each row execute function internal_security.set_updated_at();

create trigger audit_surveys after insert or update or delete on public.surveys
for each row execute function internal_security.audit_hr_change('survey');
create trigger audit_survey_questions after insert or update or delete on public.survey_questions
for each row execute function internal_security.audit_hr_change('survey_question');
create trigger audit_enps_campaigns after insert or update or delete on public.enps_campaigns
for each row execute function internal_security.audit_hr_change('enps_campaign');
create trigger audit_enps_questions after insert or update or delete on public.enps_questions
for each row execute function internal_security.audit_hr_change('enps_question');

alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_question_options enable row level security;
alter table public.survey_matrix_rows enable row level security;
alter table public.survey_invitations enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_answers enable row level security;
alter table public.enps_question_bank_categories enable row level security;
alter table public.enps_question_bank enable row level security;
alter table public.enps_campaigns enable row level security;
alter table public.enps_questions enable row level security;
alter table public.enps_invitations enable row level security;
alter table public.enps_responses enable row level security;
alter table public.enps_answers enable row level security;

create or replace function internal_security.current_user_can_manage_research_question_bank()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.user_access access
      join public.management_roles role on role.id = access.management_role_id
      join public.role_permissions role_permission on role_permission.management_role_id = role.id
      join public.permissions permission on permission.id = role_permission.permission_id
      where access.user_id = (select auth.uid())
        and access.is_active
        and (role.tenant_id is null or role.tenant_id = access.tenant_id)
        and permission.code = 'research:write'
    );
$$;

create or replace function internal_security.enps_campaign_has_minimum_responses(
  requested_campaign_id uuid,
  requested_minimum integer
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) >= greatest(requested_minimum, 5)
  from public.enps_responses response
  where response.campaign_id = requested_campaign_id;
$$;

create policy surveys_hr_read on public.surveys for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
  or exists (
    select 1 from public.survey_invitations invitation
    where invitation.survey_id = surveys.id
      and invitation.employee_id = (select internal_security.current_employee_id())
  )
);
create policy surveys_hr_insert on public.surveys for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));
create policy surveys_hr_update on public.surveys for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));
create policy surveys_hr_delete on public.surveys for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')) and status = 'DRAFT');

create policy survey_questions_read on public.survey_questions for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
  or exists (
    select 1 from public.survey_invitations invitation
    where invitation.survey_id = survey_questions.survey_id
      and invitation.employee_id = (select internal_security.current_employee_id())
  )
);
create policy survey_questions_write on public.survey_questions for all to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));

create policy survey_question_options_read on public.survey_question_options for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
  or exists (
    select 1 from public.survey_invitations invitation
    where invitation.survey_id = survey_question_options.survey_id
      and invitation.employee_id = (select internal_security.current_employee_id())
  )
);
create policy survey_question_options_write on public.survey_question_options for all to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));

create policy survey_matrix_rows_read on public.survey_matrix_rows for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
  or exists (
    select 1 from public.survey_invitations invitation
    where invitation.survey_id = survey_matrix_rows.survey_id
      and invitation.employee_id = (select internal_security.current_employee_id())
  )
);
create policy survey_matrix_rows_write on public.survey_matrix_rows for all to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));

create policy survey_invitations_read on public.survey_invitations for select to authenticated
using (
  employee_id = (select internal_security.current_employee_id())
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
);
create policy survey_invitations_hr_write on public.survey_invitations for all to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));

create policy survey_responses_results_read on public.survey_responses for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research-result:read')));
create policy survey_answers_results_read on public.survey_answers for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research-result:read')));

create policy enps_question_bank_categories_hr_read on public.enps_question_bank_categories for select to authenticated
using (
  (is_system and (select internal_security.current_user_can_manage_research_question_bank()))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
);
create policy enps_question_bank_categories_hr_write on public.enps_question_bank_categories for all to authenticated
using (
  not is_system
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
)
with check (
  not is_system
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
);
create policy enps_question_bank_hr_read on public.enps_question_bank for select to authenticated
using (
  (is_system and (select internal_security.current_user_can_manage_research_question_bank()))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
);
create policy enps_question_bank_hr_write on public.enps_question_bank for all to authenticated
using (
  not is_system
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
)
with check (
  not is_system
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
);

create policy enps_campaigns_read on public.enps_campaigns for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
  or exists (
    select 1 from public.enps_invitations invitation
    where invitation.campaign_id = enps_campaigns.id
      and invitation.employee_id = (select internal_security.current_employee_id())
  )
);
create policy enps_campaigns_insert on public.enps_campaigns for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));
create policy enps_campaigns_update on public.enps_campaigns for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));
create policy enps_campaigns_delete on public.enps_campaigns for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')) and status = 'DRAFT');

create policy enps_questions_read on public.enps_questions for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
  or exists (
    select 1 from public.enps_invitations invitation
    where invitation.campaign_id = enps_questions.campaign_id
      and invitation.employee_id = (select internal_security.current_employee_id())
  )
);
create policy enps_questions_write on public.enps_questions for all to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));

create policy enps_invitations_read on public.enps_invitations for select to authenticated
using (
  employee_id = (select internal_security.current_employee_id())
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
);
create policy enps_invitations_hr_write on public.enps_invitations for all to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));

create policy enps_responses_results_read on public.enps_responses for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research-result:read'))
  and (select internal_security.enps_campaign_has_minimum_responses(campaign_id, 5))
);
create policy enps_answers_results_read on public.enps_answers for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research-result:read'))
  and (select internal_security.enps_campaign_has_minimum_responses(campaign_id, 5))
);

create or replace function internal_security.submit_survey_response(
  requested_invitation_id uuid,
  requested_answers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.survey_invitations%rowtype;
  campaign public.surveys%rowtype;
  response_id uuid;
begin
  if jsonb_typeof(requested_answers) <> 'array'
     or jsonb_array_length(requested_answers) = 0
     or jsonb_array_length(requested_answers) > 1000 then
    raise exception 'RESEARCH_ANSWERS_INVALID' using errcode = '22023';
  end if;

  select * into invitation
  from public.survey_invitations
  where id = requested_invitation_id
  for update;

  if invitation.id is null
     or invitation.employee_id <> internal_security.current_employee_id() then
    raise exception 'RESEARCH_INVITATION_FORBIDDEN' using errcode = '42501';
  end if;
  if invitation.has_submitted then
    raise exception 'RESEARCH_ALREADY_SUBMITTED' using errcode = '23505';
  end if;

  select * into campaign from public.surveys where id = invitation.survey_id;
  if campaign.status <> 'ACTIVE'
     or timezone('utc', now()) < campaign.starts_at
     or timezone('utc', now()) > campaign.ends_at then
    raise exception 'RESEARCH_CAMPAIGN_NOT_OPEN' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.survey_questions question
    where question.survey_id = campaign.id
      and question.is_required
      and question.question_type <> 'MATRIX'
      and not exists (
        select 1 from jsonb_array_elements(requested_answers) answer
        where answer->>'questionId' = question.id::text
      )
  ) or exists (
    select 1
    from public.survey_matrix_rows matrix_row
    where matrix_row.survey_id = campaign.id
      and matrix_row.is_required
      and not exists (
        select 1 from jsonb_array_elements(requested_answers) answer
        where answer->>'questionId' = matrix_row.question_id::text
          and answer->>'matrixRowId' = matrix_row.id::text
      )
  ) then
    raise exception 'RESEARCH_REQUIRED_ANSWER_MISSING' using errcode = '23502';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(requested_answers) answer
    left join public.survey_questions question
      on question.id = (answer->>'questionId')::uuid
     and question.survey_id = campaign.id
    left join public.survey_question_options option_row
      on option_row.id = nullif(answer->>'optionId', '')::uuid
     and option_row.question_id = question.id
    left join public.survey_matrix_rows matrix_row
      on matrix_row.id = nullif(answer->>'matrixRowId', '')::uuid
     and matrix_row.question_id = question.id
    where question.id is null
       or ((answer ? 'optionId') and option_row.id is null)
       or ((answer ? 'matrixRowId') and matrix_row.id is null)
       or (not (answer ? 'optionId') and not (answer ? 'value'))
       or case question.question_type
         when 'TEXT_SINGLE' then answer ? 'optionId' or answer ? 'matrixRowId' or length(trim(answer->>'value')) not between 1 and 10000
         when 'TEXT_MULTI' then answer ? 'optionId' or answer ? 'matrixRowId' or length(trim(answer->>'value')) not between 1 and 10000
         when 'NUMBER' then answer ? 'optionId' or answer ? 'matrixRowId' or not ((answer->>'value') ~ '^-?([0-9]+([.][0-9]+)?|[.][0-9]+)$')
         when 'DATE' then answer ? 'optionId' or answer ? 'matrixRowId' or not ((answer->>'value') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
         when 'DATETIME' then answer ? 'optionId' or answer ? 'matrixRowId' or not ((answer->>'value') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}')
         when 'SINGLE_CHOICE' then not (answer ? 'optionId') or answer ? 'matrixRowId' or answer ? 'value'
         when 'MULTI_CHOICE' then not (answer ? 'optionId') or answer ? 'matrixRowId' or answer ? 'value'
         when 'MATRIX' then not (answer ? 'optionId') or not (answer ? 'matrixRowId') or answer ? 'value'
         else true
       end
  ) then
    raise exception 'RESEARCH_ANSWER_REFERENCE_INVALID' using errcode = '23503';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(requested_answers) answer
    group by answer->>'questionId', coalesce(answer->>'matrixRowId', ''), coalesce(answer->>'optionId', '')
    having count(*) > 1
  ) then
    raise exception 'RESEARCH_ANSWER_DUPLICATE' using errcode = '23505';
  end if;

  insert into public.survey_responses (tenant_id, hr_group_id, survey_id, respondent_employee_id)
  values (
    invitation.tenant_id,
    invitation.hr_group_id,
    invitation.survey_id,
    case when campaign.is_anonymous then null else invitation.employee_id end
  )
  returning id into response_id;

  insert into public.survey_answers (
    tenant_id, hr_group_id, survey_id, response_id, question_id, matrix_row_id, option_id, answer_text
  )
  select invitation.tenant_id,
         invitation.hr_group_id,
         invitation.survey_id,
         response_id,
         (answer->>'questionId')::uuid,
         nullif(answer->>'matrixRowId', '')::uuid,
         nullif(answer->>'optionId', '')::uuid,
         case when answer ? 'value' then answer->>'value' else null end
  from jsonb_array_elements(requested_answers) answer;

  update public.survey_invitations
  set has_submitted = true,
      submitted_at = timezone('utc', now())
  where id = invitation.id;

  return response_id;
end;
$$;

create or replace function public.submit_survey_response(
  p_invitation_id uuid,
  p_answers jsonb
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select internal_security.submit_survey_response(p_invitation_id, p_answers);
$$;

create or replace function internal_security.submit_enps_response(
  requested_invitation_id uuid,
  requested_answers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.enps_invitations%rowtype;
  campaign public.enps_campaigns%rowtype;
  response_id uuid;
begin
  if jsonb_typeof(requested_answers) <> 'array'
     or jsonb_array_length(requested_answers) = 0
     or jsonb_array_length(requested_answers) > 150 then
    raise exception 'RESEARCH_ANSWERS_INVALID' using errcode = '22023';
  end if;

  select * into invitation
  from public.enps_invitations
  where id = requested_invitation_id
  for update;

  if invitation.id is null
     or invitation.employee_id <> internal_security.current_employee_id() then
    raise exception 'RESEARCH_INVITATION_FORBIDDEN' using errcode = '42501';
  end if;
  if invitation.has_submitted then
    raise exception 'RESEARCH_ALREADY_SUBMITTED' using errcode = '23505';
  end if;

  select * into campaign from public.enps_campaigns where id = invitation.campaign_id;
  if campaign.status <> 'ACTIVE'
     or timezone('utc', now()) < campaign.starts_at
     or timezone('utc', now()) > campaign.ends_at then
    raise exception 'RESEARCH_CAMPAIGN_NOT_OPEN' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.enps_questions question
    where question.campaign_id = campaign.id
      and question.is_enabled
      and question.is_mandatory
      and not exists (
        select 1 from jsonb_array_elements(requested_answers) answer
        where answer->>'questionId' = question.id::text
          and (answer->>'value') ~ '^(10|[0-9])$'
      )
  ) or exists (
    select 1
    from jsonb_array_elements(requested_answers) answer
    left join public.enps_questions question
      on question.id = (answer->>'questionId')::uuid
     and question.campaign_id = campaign.id
     and question.is_enabled
    where question.id is null
       or not (answer ? 'value')
       or length(answer->>'value') > 10000
       or case question.question_type
         when 'SCALE_10' then not ((answer->>'value') ~ '^(10|[0-9])$')
         when 'LIKERT_5' then not ((answer->>'value') ~ '^[1-5]$')
         when 'LIKERT_4' then not ((answer->>'value') ~ '^[1-4]$')
         when 'YES_NO' then (answer->>'value') not in ('YES', 'NO')
         when 'OPEN_TEXT' then length(trim(answer->>'value')) < 1
         else true
       end
  ) then
    raise exception 'ENPS_ANSWER_INVALID' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(requested_answers) answer
    group by answer->>'questionId'
    having count(*) > 1
  ) then
    raise exception 'RESEARCH_ANSWER_DUPLICATE' using errcode = '23505';
  end if;

  insert into public.enps_responses (tenant_id, hr_group_id, campaign_id)
  values (invitation.tenant_id, invitation.hr_group_id, invitation.campaign_id)
  returning id into response_id;

  insert into public.enps_answers (tenant_id, hr_group_id, campaign_id, response_id, question_id, answer_value)
  select invitation.tenant_id,
         invitation.hr_group_id,
         invitation.campaign_id,
         response_id,
         (answer->>'questionId')::uuid,
         answer->>'value'
  from jsonb_array_elements(requested_answers) answer;

  -- Geen tijdstip of response-id op de uitnodiging: na indienen blijft alleen het ja/nee-signaal over.
  update public.enps_invitations set has_submitted = true where id = invitation.id;
  return response_id;
end;
$$;

create or replace function public.submit_enps_response(
  p_invitation_id uuid,
  p_answers jsonb
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select internal_security.submit_enps_response(p_invitation_id, p_answers);
$$;

revoke all on table public.surveys, public.survey_questions, public.survey_question_options,
  public.survey_matrix_rows, public.survey_invitations, public.survey_responses, public.survey_answers,
  public.enps_question_bank_categories, public.enps_question_bank, public.enps_campaigns,
  public.enps_questions, public.enps_invitations, public.enps_responses, public.enps_answers
from public, anon;

grant select, insert, update, delete on table public.surveys, public.survey_questions,
  public.survey_question_options, public.survey_matrix_rows, public.enps_campaigns, public.enps_questions
to authenticated;
grant select, insert, update, delete on table public.survey_invitations, public.enps_invitations to authenticated;
grant select on table public.survey_responses, public.survey_answers, public.enps_responses,
  public.enps_answers
to authenticated;
grant select, insert, update, delete on table public.enps_question_bank_categories, public.enps_question_bank to authenticated;

revoke all on function internal_security.submit_survey_response(uuid, jsonb) from public, anon, authenticated;
revoke all on function internal_security.submit_enps_response(uuid, jsonb) from public, anon, authenticated;
revoke all on function internal_security.current_user_can_manage_research_question_bank() from public, anon, authenticated;
revoke all on function internal_security.enps_campaign_has_minimum_responses(uuid, integer) from public, anon, authenticated;
revoke all on function public.submit_survey_response(uuid, jsonb) from public, anon;
revoke all on function public.submit_enps_response(uuid, jsonb) from public, anon;
grant execute on function public.submit_survey_response(uuid, jsonb) to authenticated;
grant execute on function public.submit_enps_response(uuid, jsonb) to authenticated;
grant execute on function internal_security.current_user_can_manage_research_question_bank() to authenticated;
grant execute on function internal_security.enps_campaign_has_minimum_responses(uuid, integer) to authenticated;

alter table public.tenant_modules
drop constraint if exists tenant_modules_module_code_check;
alter table public.tenant_modules
add constraint tenant_modules_module_code_check
  check (module_code = any (array['HERA', 'DOCUMENTS', 'REMINDERS', 'TALENT', 'SURVEYS', 'ENPS']::text[]));

insert into public.tenant_modules (tenant_id, module_code, is_enabled, enabled_at)
select tenant.id, module.code, true, timezone('utc', now())
from public.tenants tenant
cross join (values ('SURVEYS'), ('ENPS')) as module(code)
on conflict (tenant_id, module_code) do update
set is_enabled = true,
    enabled_at = coalesce(public.tenant_modules.enabled_at, excluded.enabled_at),
    disabled_at = null,
    disabled_by = null;

alter table public.personal_dashboard_widgets
drop constraint if exists personal_dashboard_widgets_widget_type_check;
alter table public.personal_dashboard_widgets
add constraint personal_dashboard_widgets_widget_type_check check (widget_type in (
  'WELCOME', 'MY_REMINDERS', 'ORGANIZATION_OVERVIEW', 'EMPLOYEE_OVERVIEW',
  'MY_PROFILE', 'PROFILE_COMPLETENESS', 'MY_EMERGENCY_CONTACTS', 'EMPLOYEE_DIRECTORY', 'UPCOMING_BIRTHDAYS',
  'HEADCOUNT_BY_DEPARTMENT', 'GENDER_DISTRIBUTION', 'EDUCATION_MIX', 'NATIONALITY_DISTRIBUTION',
  'MY_CONTRACT_DETAILS', 'CONTRACT_TYPE_MIX', 'EXPIRING_CONTRACTS', 'PROBATION_ALERTS', 'UPCOMING_STARTS',
  'CURRENT_MONTH_ENDS', 'AVERAGE_TENURE', 'EMPLOYMENT_STATUS_MIX', 'EMPLOYMENT_CHANGE_TIMELINE',
  'MY_RECENT_DOCUMENTS', 'EXPIRING_DOCUMENTS', 'DOCUMENTS_BY_CATEGORY', 'DOCUMENTS_PER_EMPLOYEE', 'DOCUMENT_REMINDER_STATUS', 'COMPANY_DOCUMENTS',
  'MY_SALARY_HISTORY', 'AVERAGE_SALARY_BY_DEPARTMENT', 'SALARY_SCALE_OCCUPANCY', 'PAYMENT_TYPE_MIX', 'COST_ALLOCATION_MIX', 'SALARY_CHANGE_TIMELINE',
  'MY_WEEKLY_ROSTER', 'WEEKDAY_HOURS', 'FTE_BY_DEPARTMENT', 'ROSTER_COVERAGE_BY_DEPARTMENT', 'UPCOMING_HOLIDAYS', 'ACTIVE_REMINDERS', 'ORGANIZATION_SUMMARY', 'WORK_PATTERNS_BY_DEPARTMENT',
  'OPEN_RESEARCH', 'RESEARCH_MONITOR'
));

insert into public.dashboard_widget_configs (tenant_id, widget_type, is_enabled)
select tenant.id, widget.type, true
from public.tenants tenant
cross join (values ('OPEN_RESEARCH'), ('RESEARCH_MONITOR')) as widget(type)
on conflict (tenant_id, widget_type) do nothing;

insert into public.dashboard_widget_role_access (tenant_id, widget_type, management_role_id)
select tenant.id, 'OPEN_RESEARCH', role.id
from public.tenants tenant
join public.management_roles role
  on (role.tenant_id is null or role.tenant_id = tenant.id)
 and role.code in ('EMPLOYEE', 'DIRECT_MANAGER', 'TENANT_ADMIN')
on conflict (tenant_id, widget_type, management_role_id) do nothing;

insert into public.dashboard_widget_role_access (tenant_id, widget_type, management_role_id)
select tenant.id, 'RESEARCH_MONITOR', role.id
from public.tenants tenant
join public.management_roles role
  on (role.tenant_id is null or role.tenant_id = tenant.id)
 and role.code = 'TENANT_ADMIN'
on conflict (tenant_id, widget_type, management_role_id) do nothing;

-- De vaste eNPS-vragenbank is productscope; gebruikerscontent blijft per campagne een snapshot.
with category_seed(name, order_index) as (
values
  ('eNPS & Algemene Tevredenheid', 1),
  ('Werkdruk, Stress & Werk-privébalans', 2),
  ('Leiderschap & Management', 3),
  ('Samenwerking & Teamdynamiek', 4),
  ('Persoonlijke Groei & Ontwikkeling', 5),
  ('Waardering, Beloning & Erkenning', 6),
  ('Autonomie, Functie & Rolhelderheid', 7),
  ('Interne Communicatie & Visie', 8),
  ('Sociale Veiligheid & Cultuur', 9),
  ('Faciliteiten, Werkplek & Hybride Werken', 10),
  ('Diversiteit, Inclusie & Gelijkwaardigheid (DEI)', 11),
  ('Innovatie, Verandering & Wendbaarheid', 12),
  ('Onboarding & Instroom (Inwerkperiode)', 13),
  ('Duurzaamheid, MVO & Maatschappelijke Betrokkenheid', 14),
  ('Vitaliteit, Gezondheid & Energiemanagement', 15)
)
insert into public.enps_question_bank_categories (name, order_index, is_system)
select name, order_index, true from category_seed
on conflict do nothing;

with question_seed(category_name, category_order, question_number, question_text, default_type, is_mandatory_enps) as (
values
  ('eNPS & Algemene Tevredenheid', 1, 1, 'Op een schaal van 0 tot 10, hoe waarschijnlijk is het dat je ons als werkgever zou aanbevelen bij vrienden of kennissen?', 'SCALE_10', true),
  ('eNPS & Algemene Tevredenheid', 1, 2, 'Wat is de belangrijkste reden voor het cijfer dat je hierboven hebt gegeven?', 'OPEN_TEXT', false),
  ('eNPS & Algemene Tevredenheid', 1, 3, 'Ik ben over het algemeen trots om bij deze organisatie te werken.', 'LIKERT_5', false),
  ('eNPS & Algemene Tevredenheid', 1, 4, 'Ik zie mezelf over twee jaar nog steeds bij dit bedrijf werken.', 'LIKERT_5', false),
  ('eNPS & Algemene Tevredenheid', 1, 5, 'Mijn werk geeft mij dagelijks een gevoel van voldoening.', 'LIKERT_5', false),
  ('eNPS & Algemene Tevredenheid', 1, 6, 'Ik zou een goede vriend aanraden om hier te solliciteren.', 'LIKERT_5', false),
  ('eNPS & Algemene Tevredenheid', 1, 7, 'De organisatie voldoet aan de verwachtingen die ik had toen ik hier kwam werken.', 'LIKERT_5', false),
  ('eNPS & Algemene Tevredenheid', 1, 8, 'Ik voel me energiek als ik aan mijn werkdag begin.', 'LIKERT_5', false),
  ('eNPS & Algemene Tevredenheid', 1, 9, 'Ik ervaar onze organisatie als een fijne en aantrekkelijke werkgever.', 'LIKERT_5', false),
  ('eNPS & Algemene Tevredenheid', 1, 10, 'Als ik opnieuw kon kiezen, zou ik weer voor dit bedrijf kiezen.', 'LIKERT_5', false),
  ('Werkdruk, Stress & Werk-privébalans', 2, 11, 'De werkdruk die ik ervaar is over het algemeen acceptabel.', 'LIKERT_5', false),
  ('Werkdruk, Stress & Werk-privébalans', 2, 12, 'Ik kan mijn werk goed combineren met mijn privéleven.', 'LIKERT_5', false),
  ('Werkdruk, Stress & Werk-privébalans', 2, 13, 'Ik kan na mijn werkdag stoom afblazen en de knop omzetten.', 'LIKERT_5', false),
  ('Werkdruk, Stress & Werk-privébalans', 2, 14, 'Ik heb voldoende tijd om mijn taken met de juiste kwaliteit uit te voeren.', 'LIKERT_5', false),
  ('Werkdruk, Stress & Werk-privébalans', 2, 15, 'Ik voel me niet structureel gehaast tijdens mijn werkzaamheden.', 'LIKERT_5', false),
  ('Werkdruk, Stress & Werk-privébalans', 2, 16, 'De organisatie stimuleert en ondersteunt een geslaagde werk-privébalans.', 'LIKERT_5', false),
  ('Werkdruk, Stress & Werk-privébalans', 2, 17, 'Ik voel voldoende ruimte om pauzes te nemen wanneer ik daar behoefte aan heb.', 'LIKERT_5', false),
  ('Werkdruk, Stress & Werk-privébalans', 2, 18, 'Ik ervaar geen ongezonde mate van stress door mijn werk.', 'LIKERT_5', false),
  ('Werkdruk, Stress & Werk-privébalans', 2, 19, 'In drukke periodes staat mijn team klaar om werk van elkaar over te nemen.', 'LIKERT_5', false),
  ('Werkdruk, Stress & Werk-privébalans', 2, 20, 'Mijn leidinggevende heeft oog voor mijn mentale en fysieke welzijn.', 'LIKERT_5', false),
  ('Leiderschap & Management', 3, 21, 'Mijn leidinggevende geeft mij voldoende vertrouwen om mijn werk autonoom te doen.', 'LIKERT_5', false),
  ('Leiderschap & Management', 3, 22, 'Mijn leidinggevende geeft mij regelmatig opbouwende feedback.', 'LIKERT_5', false),
  ('Leiderschap & Management', 3, 23, 'Ik voel dat mijn leidinggevende mij waardeert als persoon en werknemer.', 'LIKERT_5', false),
  ('Leiderschap & Management', 3, 24, 'Mijn leidinggevende is goed bereikbaar wanneer ik vragen of problemen heb.', 'LIKERT_5', false),
  ('Leiderschap & Management', 3, 25, 'Mijn leidinggevende pakt knelpunten binnen het team daadkrachtig aan.', 'LIKERT_5', false),
  ('Leiderschap & Management', 3, 26, 'De keuzes van het management zijn voor mij logisch en uit te leggen.', 'LIKERT_5', false),
  ('Leiderschap & Management', 3, 27, 'Mijn leidinggevende motiveert en inspireert mij in mijn dagelijkse werk.', 'LIKERT_5', false),
  ('Leiderschap & Management', 3, 28, 'Afspraken die ik maak met mijn leidinggevende worden ook daadwerkelijk nagekomen.', 'LIKERT_5', false),
  ('Leiderschap & Management', 3, 29, 'Mijn leidinggevende staat open voor ideeën en kritische feedback.', 'LIKERT_5', false),
  ('Leiderschap & Management', 3, 30, 'Ik heb het gevoel dat het management transparant en eerlijk communiceert.', 'LIKERT_5', false),
  ('Samenwerking & Teamdynamiek', 4, 31, 'Binnen mijn team werken we prettig en constructief samen.', 'LIKERT_5', false),
  ('Samenwerking & Teamdynamiek', 4, 32, 'Mijn collega''s tonen oprechte interesse in elkaar.', 'LIKERT_5', false),
  ('Samenwerking & Teamdynamiek', 4, 33, 'Kennis en informatie worden gemakkelijk gedeeld binnen ons team.', 'LIKERT_5', false),
  ('Samenwerking & Teamdynamiek', 4, 34, 'Als ik ergens niet uitkom, kan ik rekenen op de hulp van mijn collega''s.', 'LIKERT_5', false),
  ('Samenwerking & Teamdynamiek', 4, 35, 'Meningsverschillen binnen ons team worden op een gezonde manier opgelost.', 'LIKERT_5', false),
  ('Samenwerking & Teamdynamiek', 4, 36, 'De samenwerking met andere afdelingen of teams verloopt soepel.', 'LIKERT_5', false),
  ('Samenwerking & Teamdynamiek', 4, 37, 'Nieuwe collega''s worden bij ons warm en goed opgevangen.', 'LIKERT_5', false),
  ('Samenwerking & Teamdynamiek', 4, 38, 'Iedereen binnen ons team neemt verantwoordelijkheid voor het eindresultaat.', 'LIKERT_5', false),
  ('Samenwerking & Teamdynamiek', 4, 39, 'Er is een goede verdeling van taken binnen het team.', 'LIKERT_5', false),
  ('Samenwerking & Teamdynamiek', 4, 40, 'We vieren onze successen regelmatig samen als team.', 'LIKERT_5', false),
  ('Persoonlijke Groei & Ontwikkeling', 5, 41, 'Ik krijg voldoende kansen om me vakinhoudelijk verder te ontwikkelen.', 'LIKERT_5', false),
  ('Persoonlijke Groei & Ontwikkeling', 5, 42, 'Er is binnen het bedrijf ruimte om fouten te maken en daarvan te leren.', 'LIKERT_5', false),
  ('Persoonlijke Groei & Ontwikkeling', 5, 43, 'Mijn werk biedt mij voldoende uitdaging om scherp te blijven.', 'LIKERT_5', false),
  ('Persoonlijke Groei & Ontwikkeling', 5, 44, 'Binnen deze organisatie zijn er duidelijke doorgroeimogelijkheden.', 'LIKERT_5', false),
  ('Persoonlijke Groei & Ontwikkeling', 5, 45, 'Ik word gestimuleerd om nieuwe vaardigheden op te doen of opleidingen te volgen.', 'LIKERT_5', false),
  ('Persoonlijke Groei & Ontwikkeling', 5, 46, 'Mijn leidinggevende helpt mij actief bij het behalen van mijn ontwikkeldoelen.', 'LIKERT_5', false),
  ('Persoonlijke Groei & Ontwikkeling', 5, 47, 'Ik kan mijn talenten en kwaliteiten optimaal inzetten in mijn huidige functie.', 'LIKERT_5', false),
  ('Persoonlijke Groei & Ontwikkeling', 5, 48, 'We bespreken mijn persoonlijke ontwikkeling minimaal één keer per jaar.', 'LIKERT_5', false),
  ('Persoonlijke Groei & Ontwikkeling', 5, 49, 'Ik zie een langetermijntoekomst voor mezelf binnen dit bedrijf.', 'LIKERT_5', false),
  ('Persoonlijke Groei & Ontwikkeling', 5, 50, 'De ervaring die ik hier opdoe is waardevol voor mijn verdere loopbaan.', 'LIKERT_5', false),
  ('Waardering, Beloning & Erkenning', 6, 51, 'Ik voel me voldoende gewaardeerd voor de inzet die ik toon.', 'LIKERT_5', false),
  ('Waardering, Beloning & Erkenning', 6, 52, 'Goede prestaties worden binnen ons bedrijf opgemerkt en beloond.', 'LIKERT_5', false),
  ('Waardering, Beloning & Erkenning', 6, 53, 'Mijn salaris en secundaire arbeidsvoorwaarden vind ik marktconform en eerlijk.', 'LIKERT_5', false),
  ('Waardering, Beloning & Erkenning', 6, 54, 'Schouderklopjes en complimenten worden bij ons regelmatig uitgedeeld.', 'LIKERT_5', false),
  ('Waardering, Beloning & Erkenning', 6, 55, 'Ik heb het gevoel dat alle medewerkers gelijke kansen krijgen binnen het bedrijf.', 'LIKERT_5', false),
  ('Waardering, Beloning & Erkenning', 6, 56, 'Als ik extra moeite doe, wordt dat opgemerkt door mijn leidinggevende.', 'LIKERT_5', false),
  ('Waardering, Beloning & Erkenning', 6, 57, 'De nevenvoorwaarden (zoals pensioen, reiskosten, vakantiedagen) zijn goed geregeld.', 'LIKERT_5', false),
  ('Waardering, Beloning & Erkenning', 6, 58, 'Ik voel me geen ''nummer'', maar een gewaardeerde schakel in de organisatie.', 'LIKERT_5', false),
  ('Waardering, Beloning & Erkenning', 6, 59, 'Mijn bijdrage aan het succes van het bedrijf is voor iedereen helder.', 'LIKERT_5', false),
  ('Waardering, Beloning & Erkenning', 6, 60, 'Binnen ons team spreken we regelmatig onze dankbaarheid naar elkaar uit.', 'LIKERT_5', false),
  ('Autonomie, Functie & Rolhelderheid', 7, 61, 'Het is voor mij volkomen duidelijk wat er in mijn functie van mij wordt verwacht.', 'LIKERT_5', false),
  ('Autonomie, Functie & Rolhelderheid', 7, 62, 'Ik heb voldoende vrijheid om zelf te bepalen hoe ik mijn werk indeel.', 'LIKERT_5', false),
  ('Autonomie, Functie & Rolhelderheid', 7, 63, 'Mijn takenpakket sluit goed aan bij mijn kennis, kunde en interesses.', 'LIKERT_5', false),
  ('Autonomie, Functie & Rolhelderheid', 7, 64, 'Ik heb de bevoegdheid om zelf beslissingen te nemen binnen mijn vakgebied.', 'LIKERT_5', false),
  ('Autonomie, Functie & Rolhelderheid', 7, 65, 'Ik weet precies hoe mijn werk bijdraagt aan de doelstellingen van het bedrijf.', 'LIKERT_5', false),
  ('Autonomie, Functie & Rolhelderheid', 7, 66, 'Mijn werkzaamheden zijn afwisselend genoeg.', 'LIKERT_5', false),
  ('Autonomie, Functie & Rolhelderheid', 7, 67, 'Ik kan efficiënt werken zonder continu onderbroken te worden.', 'LIKERT_5', false),
  ('Autonomie, Functie & Rolhelderheid', 7, 68, 'De doelen die aan mij gesteld worden zijn realistisch en haalbaar.', 'LIKERT_5', false),
  ('Autonomie, Functie & Rolhelderheid', 7, 69, 'Ik voel me eigenaar van de projecten en taken die onder mij vallen.', 'LIKERT_5', false),
  ('Autonomie, Functie & Rolhelderheid', 7, 70, 'De regels en procedures in het bedrijf helpen mij om mijn werk beter te doen.', 'LIKERT_5', false),
  ('Interne Communicatie & Visie', 8, 71, 'Ik ben goed op de hoogte van de belangrijkste ontwikkelingen binnen het bedrijf.', 'LIKERT_5', false),
  ('Interne Communicatie & Visie', 8, 72, 'De missie, visie en toekomstplannen van de organisatie zijn helder voor mij.', 'LIKERT_5', false),
  ('Interne Communicatie & Visie', 8, 73, 'Er wordt tijdig gecommuniceerd als er belangrijke veranderingen op komst zijn.', 'LIKERT_5', false),
  ('Interne Communicatie & Visie', 8, 74, 'De directie/het management staat benaderbaar tegenover medewerkers.', 'LIKERT_5', false),
  ('Interne Communicatie & Visie', 8, 75, 'Informatie die ik nodig heb voor mijn werk is makkelijk en snel te vinden.', 'LIKERT_5', false),
  ('Interne Communicatie & Visie', 8, 76, 'Besluiten van het management worden transparant toegelicht.', 'LIKERT_5', false),
  ('Interne Communicatie & Visie', 8, 77, 'Mijn mening en ideeën worden serieus genomen als ik deze inbreng.', 'LIKERT_5', false),
  ('Interne Communicatie & Visie', 8, 78, 'De communicatie tussen verschillende afdelingen verloopt open en eerlijk.', 'LIKERT_5', false),
  ('Interne Communicatie & Visie', 8, 79, 'Ik begrijp waarom het bedrijf bepaalde strategische keuzes maakt.', 'LIKERT_5', false),
  ('Interne Communicatie & Visie', 8, 80, 'Er is voldoende ruimte om vragen te stellen tijdens algemene bedrijfspresentaties.', 'LIKERT_5', false),
  ('Sociale Veiligheid & Cultuur', 9, 81, 'Ik voel me psychologisch en sociaal veilig op mijn werkplek.', 'LIKERT_5', false),
  ('Sociale Veiligheid & Cultuur', 9, 82, 'Binnen de organisatie wordt pesten, discriminatie of ongewenst gedrag niet getolereerd.', 'LIKERT_5', false),
  ('Sociale Veiligheid & Cultuur', 9, 83, 'Ik durf mijn mening te uiten, ook als deze afwijkt van de rest van de groep.', 'LIKERT_5', false),
  ('Sociale Veiligheid & Cultuur', 9, 84, 'Als ik een fout maak, weet ik dat ik niet direct veroordeeld word.', 'LIKERT_5', false),
  ('Sociale Veiligheid & Cultuur', 9, 85, 'Er is een vertrouwenspersoon of aanspreekpunt waar ik terechtkan bij problemen.', 'LIKERT_5', false),
  ('Sociale Veiligheid & Cultuur', 9, 86, 'Iedereen wordt gelijkwaardig behandeld, ongeacht achtergrond, leeftijd of geslacht.', 'LIKERT_5', false),
  ('Sociale Veiligheid & Cultuur', 9, 87, 'Onze bedrijfscultuur stimuleert eerlijkheid en oprechtheid.', 'LIKERT_5', false),
  ('Sociale Veiligheid & Cultuur', 9, 88, 'Ik kan mezelf zijn op de werkvloer zonder me anders te hoeven voordoen.', 'LIKERT_5', false),
  ('Sociale Veiligheid & Cultuur', 9, 89, 'Er heerst een gevoel van onderling respect op alle niveaus in de organisatie.', 'LIKERT_5', false),
  ('Sociale Veiligheid & Cultuur', 9, 90, 'Als er sprake is van ongewenst gedrag, treedt de organisatie hier daadkrachtig tegen op.', 'LIKERT_5', false),
  ('Faciliteiten, Werkplek & Hybride Werken', 10, 91, 'Mijn fysieke werkplek (bureau, stoel, verlichting) is ergonomisch en prettig.', 'LIKERT_5', false),
  ('Faciliteiten, Werkplek & Hybride Werken', 10, 92, 'De IT-systemen, software en apparatuur werken goed en ondersteunen mijn werk.', 'LIKERT_5', false),
  ('Faciliteiten, Werkplek & Hybride Werken', 10, 93, 'Ik beschik over de juiste middelen om mijn werk naar behoren uit te voeren.', 'LIKERT_5', false),
  ('Faciliteiten, Werkplek & Hybride Werken', 10, 94, 'De faciliteiten voor thuiswerken/hybride werken zijn goed geregeld.', 'LIKERT_5', false),
  ('Faciliteiten, Werkplek & Hybride Werken', 10, 95, 'Het kantoor/de werklocatie is een schone, veilige en inspirerende omgeving.', 'LIKERT_5', false),
  ('Faciliteiten, Werkplek & Hybride Werken', 10, 96, 'De kleding-, veiligheids- of hygiënevoorschriften zijn helder en worden nageleefd.', 'LIKERT_5', false),
  ('Faciliteiten, Werkplek & Hybride Werken', 10, 97, 'Storingen in faciliteiten of IT worden snel en vakkundig opgelost.', 'LIKERT_5', false),
  ('Faciliteiten, Werkplek & Hybride Werken', 10, 98, 'Ik ervaar de maaltijd-, koffie- of kantinefaciliteiten als voldoende en goed.', 'LIKERT_5', false),
  ('Faciliteiten, Werkplek & Hybride Werken', 10, 99, 'De reistijd of bereikbaarheid van de werkplek is acceptabel voor mij.', 'LIKERT_5', false),
  ('Faciliteiten, Werkplek & Hybride Werken', 10, 100, 'Ik vind dat het bedrijf voldoende investeert in een moderne en schone werkomgeving.', 'LIKERT_5', false),
  ('Diversiteit, Inclusie & Gelijkwaardigheid (DEI)', 11, 101, 'Binnen onze organisatie voelt iedereen zich welkom, ongeacht achtergrond, leeftijd, geaardheid of gender.', 'LIKERT_5', false),
  ('Diversiteit, Inclusie & Gelijkwaardigheid (DEI)', 11, 102, 'Iedereen binnen ons bedrijf krijgt gelijke kansen om te groeien en promotie te maken.', 'LIKERT_5', false),
  ('Diversiteit, Inclusie & Gelijkwaardigheid (DEI)', 11, 103, 'Mijn unieke achtergrond, ervaring en perspectief worden gewaardeerd in mijn team.', 'LIKERT_5', false),
  ('Diversiteit, Inclusie & Gelijkwaardigheid (DEI)', 11, 104, 'De organisatie zet zich actief in voor een diverse en inclusieve werkomgeving.', 'LIKERT_5', false),
  ('Diversiteit, Inclusie & Gelijkwaardigheid (DEI)', 11, 105, 'Ik kan mezelf zijn op het werk zonder dat ik me aan hoef te passen aan een ongeschreven norm.', 'LIKERT_5', false),
  ('Diversiteit, Inclusie & Gelijkwaardigheid (DEI)', 11, 106, 'Vacatures en doorgroeitrajecten worden op een eerlijke en transparante manier opengesteld.', 'LIKERT_5', false),
  ('Diversiteit, Inclusie & Gelijkwaardigheid (DEI)', 11, 107, 'Het management geeft het goede voorbeeld als het gaat om inclusiviteit en gelijkwaardigheid.', 'LIKERT_5', false),
  ('Diversiteit, Inclusie & Gelijkwaardigheid (DEI)', 11, 108, 'Ik voel me comfortabel om onbewuste vooroordelen of uitsluiting bespreekbaar te maken.', 'LIKERT_5', false),
  ('Diversiteit, Inclusie & Gelijkwaardigheid (DEI)', 11, 109, 'De organisatie houdt rekening met individuele behoeften van medewerkers.', 'LIKERT_5', false),
  ('Diversiteit, Inclusie & Gelijkwaardigheid (DEI)', 11, 110, 'In ons team maken we gebruik van de kracht van verschillende meningen en inzichten.', 'LIKERT_5', false),
  ('Innovatie, Verandering & Wendbaarheid', 12, 111, 'Onze organisatie staat open voor vernieuwing en nieuwe manieren van werken.', 'LIKERT_5', false),
  ('Innovatie, Verandering & Wendbaarheid', 12, 112, 'Ideeën voor verbetering vanuit medewerkers worden snel en serieus opgepakt.', 'LIKERT_5', false),
  ('Innovatie, Verandering & Wendbaarheid', 12, 113, 'We passen ons als bedrijf snel aan als de markt of omstandigheden veranderen.', 'LIKERT_5', false),
  ('Innovatie, Verandering & Wendbaarheid', 12, 114, 'Binnen ons bedrijf wordt geëxperimenteerd met nieuwe methoden, technieken of middelen.', 'LIKERT_5', false),
  ('Innovatie, Verandering & Wendbaarheid', 12, 115, 'Mijn leidinggevende moedigt mij aan om met slimmere en efficiëntere oplossingen te komen.', 'LIKERT_5', false),
  ('Innovatie, Verandering & Wendbaarheid', 12, 116, 'Veranderingen in de organisatie worden op een prettige en professionele manier begeleid.', 'LIKERT_5', false),
  ('Innovatie, Verandering & Wendbaarheid', 12, 117, 'We leren als organisatie actief van fouten uit het verleden.', 'LIKERT_5', false),
  ('Innovatie, Verandering & Wendbaarheid', 12, 118, 'De organisatie loopt voorop op het gebied van digitale middelen en innovatie binnen onze branche.', 'LIKERT_5', false),
  ('Innovatie, Verandering & Wendbaarheid', 12, 119, 'Er is binnen ons team ruimte om te innoveren zonder dat het direct succesvol hoeft te zijn.', 'LIKERT_5', false),
  ('Innovatie, Verandering & Wendbaarheid', 12, 120, 'Ik word voldoende betrokken bij veranderingen die mijn dagelijkse werk beïnvloeden.', 'LIKERT_5', false),
  ('Onboarding & Instroom (Inwerkperiode)', 13, 121, 'Mijn eerste werkweek/inwerkperiode was goed georganiseerd en gestructureerd.', 'LIKERT_5', false),
  ('Onboarding & Instroom (Inwerkperiode)', 13, 122, 'Ik beschikte vanaf mijn eerste werkdag over alle benodigde middelen (laptop, accounts, pasjes).', 'LIKERT_5', false),
  ('Onboarding & Instroom (Inwerkperiode)', 13, 123, 'Het inwerkprogramma gaf mij een realistisch en goed beeld van mijn taken en verantwoordelijkheden.', 'LIKERT_5', false),
  ('Onboarding & Instroom (Inwerkperiode)', 13, 124, 'Ik voelde me vanaf de eerste dag op mijn gemak en welkom geheten door mijn team.', 'LIKERT_5', false),
  ('Onboarding & Instroom (Inwerkperiode)', 13, 125, 'Mijn verwachtingen over de functie en het bedrijf komen overeen met de werkelijkheid.', 'LIKERT_5', false),
  ('Onboarding & Instroom (Inwerkperiode)', 13, 126, 'Ik ben tijdens mijn inwerktraject goed begeleid door een leidinggevende of buddy.', 'LIKERT_5', false),
  ('Onboarding & Instroom (Inwerkperiode)', 13, 127, 'Informatie over procedures, regels en de organisatiecultuur was snel en makkelijk vindbaar.', 'LIKERT_5', false),
  ('Onboarding & Instroom (Inwerkperiode)', 13, 128, 'Ik wist na mijn eerste maand precies bij wie ik voor welke vragen terechtkon.', 'LIKERT_5', false),
  ('Onboarding & Instroom (Inwerkperiode)', 13, 129, 'De vacaturetekst en sollicitatiegesprekken gaven een eerlijk beeld van de organisatie.', 'LIKERT_5', false),
  ('Onboarding & Instroom (Inwerkperiode)', 13, 130, 'Ik zou het inwerkproces van deze organisatie cijfermatig een ruime voldoende geven.', 'LIKERT_5', false),
  ('Duurzaamheid, MVO & Maatschappelijke Betrokkenheid', 14, 131, 'Onze organisatie neemt aantoonbaar haar verantwoordelijkheid voor mens, milieu en maatschappij.', 'LIKERT_5', false),
  ('Duurzaamheid, MVO & Maatschappelijke Betrokkenheid', 14, 132, 'Ik ben trots op de maatschappelijke bijdrage die ons bedrijf levert.', 'LIKERT_5', false),
  ('Duurzaamheid, MVO & Maatschappelijke Betrokkenheid', 14, 133, 'Er wordt op de werkvloer actief gelet op duurzaamheid (bijv. afval scheiden, energie besparen, papierloos werken).', 'LIKERT_5', false),
  ('Duurzaamheid, MVO & Maatschappelijke Betrokkenheid', 14, 134, 'De organisatie stimuleert duurzaam reizen en milieuvriendelijke mobiliteit.', 'LIKERT_5', false),
  ('Duurzaamheid, MVO & Maatschappelijke Betrokkenheid', 14, 135, 'Maatschappelijk Verantwoord Ondernemen (MVO) is een zichtbaar onderdeel van onze bedrijfscultuur.', 'LIKERT_5', false),
  ('Duurzaamheid, MVO & Maatschappelijke Betrokkenheid', 14, 136, 'Het bedrijf ondersteunt maatschappelijke initiatieven, goede doelen of lokale projecten.', 'LIKERT_5', false),
  ('Duurzaamheid, MVO & Maatschappelijke Betrokkenheid', 14, 137, 'Onze producten of diensten dragen op een positieve manier bij aan de maatschappij.', 'LIKERT_5', false),
  ('Duurzaamheid, MVO & Maatschappelijke Betrokkenheid', 14, 138, 'Ik krijg de ruimte om me vanuit het bedrijf in te zetten voor maatschappelijke doelen.', 'LIKERT_5', false),
  ('Duurzaamheid, MVO & Maatschappelijke Betrokkenheid', 14, 139, 'Ethisch handelen en integriteit staan bij ons bedrijf op de eerste plaats.', 'LIKERT_5', false),
  ('Duurzaamheid, MVO & Maatschappelijke Betrokkenheid', 14, 140, 'De duurzaamheidsdoelstellingen van de organisatie zijn helder en concreet.', 'LIKERT_5', false),
  ('Vitaliteit, Gezondheid & Energiemanagement', 15, 141, 'De organisatie biedt voldoende faciliteiten of initiatieven die mijn gezondheid en vitaliteit bevorderen.', 'LIKERT_5', false),
  ('Vitaliteit, Gezondheid & Energiemanagement', 15, 142, 'Ik ervaar een gezonde fysieke belasting tijdens mijn dagelijkse werkzaamheden.', 'LIKERT_5', false),
  ('Vitaliteit, Gezondheid & Energiemanagement', 15, 143, 'Er wordt op het werk voldoende aandacht besteed aan gezonde voeding, beweging of ergonomie.', 'LIKERT_5', false),
  ('Vitaliteit, Gezondheid & Energiemanagement', 15, 144, 'Ik kan openlijk praten over mijn mentale welzijn of energieniveau met mijn leidinggevende.', 'LIKERT_5', false),
  ('Vitaliteit, Gezondheid & Energiemanagement', 15, 145, 'Ik ervaar aan het einde van mijn werkweek nog genoeg energie voor mijn privéleven.', 'LIKERT_5', false),
  ('Vitaliteit, Gezondheid & Energiemanagement', 15, 146, 'Het bedrijf stimuleert het nemen van voldoende hersteltijd en vakanties.', 'LIKERT_5', false),
  ('Vitaliteit, Gezondheid & Energiemanagement', 15, 147, 'Als ik fysieke of mentale klachten ervaar, biedt het bedrijf adequate ondersteuning.', 'LIKERT_5', false),
  ('Vitaliteit, Gezondheid & Energiemanagement', 15, 148, 'Ik voel geen druk om bereikbaar te zijn buiten mijn afgesproken werktijden.', 'LIKERT_5', false),
  ('Vitaliteit, Gezondheid & Energiemanagement', 15, 149, 'De werkomgeving (klimaat, licht, geluid) draagt positief bij aan mijn vitaliteit.', 'LIKERT_5', false),
  ('Vitaliteit, Gezondheid & Energiemanagement', 15, 150, 'Ik word gestimuleerd om tijdens mijn werkdag voldoende te bewegen en niet alleen maar te zitten.', 'LIKERT_5', false)
)
insert into public.enps_question_bank (
  category_id, question_number, question_text, default_type, is_mandatory_enps, is_system
)
select category.id,
       seed.question_number,
       seed.question_text,
       seed.default_type,
       seed.is_mandatory_enps,
       true
from question_seed seed
join public.enps_question_bank_categories category
  on category.order_index = seed.category_order
 and category.name = seed.category_name
on conflict do nothing;

create trigger audit_enps_question_bank_categories after insert or update or delete on public.enps_question_bank_categories
for each row execute function internal_security.audit_hr_change('enps_question_bank_category');
create trigger audit_enps_question_bank after insert or update or delete on public.enps_question_bank
for each row execute function internal_security.audit_hr_change('enps_question_bank_question');

commit;
