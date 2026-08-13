-- Guided Recruitment stap 1: HR-groepkern, lifecycle en afgeschermde dossierdata.

alter table public.tenant_modules drop constraint if exists tenant_modules_module_code_check;
alter table public.tenant_modules add constraint tenant_modules_module_code_check
  check (module_code in ('HERA','REMINDERS','TALENT','SURVEYS','ENPS','TEAM_COMPASS','JOURNEYS','RECRUITMENT','DOCUMENTS'));

insert into public.tenant_modules (tenant_id, module_code, is_enabled, enabled_at)
select tenant.id, 'RECRUITMENT', false, null
from public.tenants tenant
on conflict (tenant_id, module_code) do nothing;

insert into public.permissions (code, name, category, description) values
  ('recruitment-vacancy:read', 'Vacatures lezen', 'Recruitment', 'Vacatures binnen toegestane HR-groepen lezen.'),
  ('recruitment-vacancy:write', 'Vacatures beheren', 'Recruitment', 'Vacatures binnen toegestane HR-groepen beheren.'),
  ('recruitment-vacancy:publish', 'Vacatures publiceren', 'Recruitment', 'Vacaturepublicaties openen, sluiten en archiveren.'),
  ('recruitment-candidate:read', 'Sollicitanten lezen', 'Recruitment', 'Kandidaten en sollicitatiedossiers binnen toegestane HR-groepen lezen.'),
  ('recruitment-candidate:write', 'Sollicitanten beheren', 'Recruitment', 'Kandidaten en sollicitatiedossiers binnen toegestane HR-groepen beheren.'),
  ('recruitment-assessment:read', 'Beoordelingen lezen', 'Recruitment', 'Toegestane recruitmentbeoordelingen lezen.'),
  ('recruitment-assessment:write', 'Beoordelingen invullen', 'Recruitment', 'Eigen toegewezen recruitmentbeoordelingen invullen.'),
  ('recruitment-settings:manage', 'Recruitmentinstellingen beheren', 'Recruitment', 'Pipeline, bibliotheek, sets, publicatie en privacy beheren.'),
  ('recruitment-participation:read', 'Toegewezen sollicitaties lezen', 'Recruitment', 'Alleen concrete actieve recruitmentdeelnames lezen.'),
  ('recruitment-participation:write', 'Toegewezen sollicitaties beoordelen', 'Recruitment', 'Alleen binnen concrete actieve recruitmentdeelnames schrijven.')
on conflict (code) do update set name = excluded.name, category = excluded.category, description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on
  (role.code = 'TENANT_ADMIN' and permission.code like 'recruitment-%')
  or (role.code in ('EMPLOYEE','DIRECT_MANAGER') and permission.code in ('recruitment-participation:read','recruitment-participation:write'))
on conflict do nothing;

alter type public.custom_field_entity_type add value if not exists 'RECRUITMENT_APPLICATION';

create table public.recruitment_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  retention_days integer not null default 28 check (retention_days between 1 and 3650),
  public_branding jsonb not null default '{}'::jsonb check (jsonb_typeof(public_branding) = 'object'),
  publication_defaults jsonb not null default '{}'::jsonb check (jsonb_typeof(publication_defaults) = 'object'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  unique (tenant_id, hr_group_id),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete cascade
);

create table public.recruitment_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  code text not null check (code ~ '^[A-Z][A-Z0-9_]{1,62}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  unique (tenant_id, hr_group_id, code),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete cascade
);

create table public.recruitment_vacancies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  job_id uuid,
  location_label text,
  work_mode text check (work_mode is null or work_mode in ('ON_SITE','HYBRID','REMOTE')),
  min_hours numeric(5,2) check (min_hours is null or min_hours between 0 and 168),
  max_hours numeric(5,2) check (max_hours is null or max_hours between 0 and 168),
  salary_min numeric(12,2),
  salary_max numeric(12,2),
  salary_visible boolean not null default false,
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','CLOSED','ARCHIVED')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete restrict,
  foreign key (tenant_id, hr_group_id, job_id) references public.jobs(tenant_id, hr_group_id, id) on delete restrict,
  check (job_id is not null or char_length(btrim(title)) > 0),
  check (min_hours is null or max_hours is null or min_hours <= max_hours),
  check (salary_min is null or salary_max is null or salary_min <= salary_max)
);

create table public.recruitment_vacancy_sections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  vacancy_id uuid not null,
  section_type text not null check (section_type in ('INTRODUCTION','ROLE','PROFILE','OFFER','PROCESS','CONTACT')),
  content text not null default '',
  sort_order integer not null,
  is_visible boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, vacancy_id, section_type),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, vacancy_id) references public.recruitment_vacancies(tenant_id, hr_group_id, id) on delete cascade
);

create table public.recruitment_vacancy_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  vacancy_id uuid not null,
  definition_id uuid not null,
  label_snapshot text not null check (char_length(btrim(label_snapshot)) between 1 and 180),
  type_snapshot public.custom_field_type not null,
  options_snapshot jsonb not null default '[]'::jsonb check (jsonb_typeof(options_snapshot) = 'array'),
  validation_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(validation_snapshot) = 'object'),
  is_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, vacancy_id, definition_id),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, vacancy_id) references public.recruitment_vacancies(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, definition_id) references public.custom_field_definitions(tenant_id, hr_group_id, id) on delete restrict
);

create table public.recruitment_publications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  vacancy_id uuid not null,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED','ARCHIVED')),
  published_title text not null,
  published_location text,
  published_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(published_payload) = 'object'),
  opened_at timestamptz,
  closed_at timestamptz,
  archived_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, id),
  unique (tenant_id, hr_group_id, slug),
  foreign key (tenant_id, hr_group_id, vacancy_id) references public.recruitment_vacancies(tenant_id, hr_group_id, id) on delete cascade,
  check ((status = 'OPEN' and opened_at is not null and closed_at is null and archived_at is null)
    or (status = 'CLOSED' and closed_at is not null and archived_at is null)
    or (status = 'ARCHIVED' and archived_at is not null))
);

create table public.recruitment_candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 120),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 160),
  private_email text,
  normalized_email text,
  phone text,
  possible_duplicate boolean not null default false,
  anonymized_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete restrict,
  check (normalized_email is null or normalized_email = lower(btrim(normalized_email))),
  check (anonymized_at is null or (private_email is null and normalized_email is null and phone is null))
);

create table public.recruitment_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  vacancy_id uuid not null,
  candidate_id uuid not null,
  active_stage_id uuid,
  terminal_outcome text,
  source text not null default 'MANUAL' check (source in ('MANUAL','PUBLIC')),
  motivation text,
  terminal_reason text,
  terminal_note text,
  terminal_at timestamptz,
  retention_due_at timestamptz,
  anonymized_at timestamptz,
  converted_at timestamptz,
  converted_by_user_id uuid references auth.users(id) on delete set null,
  administration_id uuid,
  employee_id uuid,
  employment_id uuid,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, vacancy_id) references public.recruitment_vacancies(tenant_id, hr_group_id, id) on delete restrict,
  foreign key (tenant_id, hr_group_id, candidate_id) references public.recruitment_candidates(tenant_id, hr_group_id, id) on delete restrict,
  foreign key (tenant_id, hr_group_id, active_stage_id) references public.recruitment_pipeline_stages(tenant_id, hr_group_id, id) on delete restrict,
  foreign key (tenant_id, administration_id) references public.administrations(tenant_id, id) on delete restrict,
  foreign key (tenant_id, employee_id) references public.employees(tenant_id, id) on delete restrict,
  foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id) on delete restrict,
  check (terminal_outcome in ('AFGEWEZEN','AANGENOMEN') or terminal_outcome is null),
  check ((terminal_outcome is null and active_stage_id is not null and terminal_at is null)
    or (terminal_outcome is not null and active_stage_id is null and terminal_at is not null)),
  check (terminal_outcome = 'AANGENOMEN' or (administration_id is null and employee_id is null and employment_id is null and converted_at is null)),
  check (employee_id is not null or (employment_id is null and converted_at is null))
);

create table public.recruitment_application_answers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  application_id uuid not null,
  vacancy_question_id uuid not null,
  value jsonb not null,
  label_snapshot text not null,
  type_snapshot public.custom_field_type not null,
  options_snapshot jsonb not null default '[]'::jsonb check (jsonb_typeof(options_snapshot) = 'array'),
  validation_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(validation_snapshot) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, application_id, vacancy_question_id),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, application_id) references public.recruitment_applications(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, vacancy_question_id) references public.recruitment_vacancy_questions(tenant_id, hr_group_id, id) on delete restrict
);

create table public.recruitment_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  application_id uuid not null,
  storage_key text not null,
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null check (file_size between 1 and 10485760),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  scan_status text not null default 'QUARANTINED' check (scan_status in ('QUARANTINED','SCANNING','CLEAN','REJECTED','ERROR')),
  scanner_reference text,
  scanner_result jsonb not null default '{}'::jsonb check (jsonb_typeof(scanner_result) = 'object'),
  scanned_at timestamptz,
  deleted_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (storage_key),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, application_id) references public.recruitment_applications(tenant_id, hr_group_id, id) on delete cascade,
  check ((scan_status = 'CLEAN' and scanned_at is not null and scanner_reference is not null)
    or scan_status <> 'CLEAN')
);

create table public.recruitment_library_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  owner_type text not null default 'HR_GROUP' check (owner_type in ('SYSTEM','HR_GROUP')),
  item_type text not null check (item_type in ('APPLICATION_QUESTION','INTERVIEW_QUESTION','CRITERION','PREPARATION')),
  stable_code text not null check (stable_code ~ '^[A-Z][A-Z0-9_]{1,80}$'),
  version integer not null default 1 check (version > 0),
  title text not null,
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  unique (tenant_id, hr_group_id, stable_code, version),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete cascade
);

create table public.recruitment_library_item_states (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  library_item_id uuid not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, library_item_id),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, library_item_id) references public.recruitment_library_items(tenant_id, hr_group_id, id) on delete cascade
);

create table public.recruitment_characteristics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  stable_code text not null check (stable_code ~ '^[A-Z][A-Z0-9_]{1,80}$'),
  name text not null,
  description text,
  is_active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, stable_code),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete cascade
);

create table public.recruitment_sets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  owner_type text not null default 'HR_GROUP' check (owner_type in ('SYSTEM','HR_GROUP')),
  stable_code text not null check (stable_code ~ '^[A-Z][A-Z0-9_]{1,80}$'),
  name text not null,
  description text,
  is_active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, stable_code, version),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete cascade
);

create table public.recruitment_set_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  set_id uuid not null,
  library_item_id uuid not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, set_id, library_item_id),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, set_id) references public.recruitment_sets(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, library_item_id) references public.recruitment_library_items(tenant_id, hr_group_id, id) on delete restrict
);

create table public.recruitment_interviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  application_id uuid not null,
  set_id uuid,
  title text not null,
  scheduled_at timestamptz,
  status text not null default 'PLANNED' check (status in ('PLANNED','COMPLETED','CANCELLED')),
  preparation_snapshot jsonb not null default '[]'::jsonb check (jsonb_typeof(preparation_snapshot) = 'array'),
  questions_snapshot jsonb not null default '[]'::jsonb check (jsonb_typeof(questions_snapshot) = 'array'),
  criteria_snapshot jsonb not null default '[]'::jsonb check (jsonb_typeof(criteria_snapshot) = 'array'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, application_id) references public.recruitment_applications(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, set_id) references public.recruitment_sets(tenant_id, hr_group_id, id) on delete restrict
);

create table public.recruitment_participations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  application_id uuid not null,
  interview_id uuid,
  employee_id uuid not null,
  status text not null default 'ASSIGNED' check (status in ('ASSIGNED','ACTIVE','REVOKED')),
  capabilities text[] not null default array['APPLICATION_READ']::text[] check (cardinality(capabilities) > 0),
  assigned_at timestamptz not null default timezone('utc', now()),
  activated_at timestamptz,
  revoked_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, application_id, interview_id, employee_id),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, application_id) references public.recruitment_applications(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, interview_id) references public.recruitment_interviews(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, employee_id) references public.employees(tenant_id, id) on delete restrict,
  check (capabilities <@ array['APPLICATION_READ','DOCUMENT_READ','INTERVIEW_READ','ASSESSMENT_READ','ASSESSMENT_WRITE']::text[]),
  check ((status = 'ASSIGNED' and activated_at is null and revoked_at is null)
    or (status = 'ACTIVE' and activated_at is not null and revoked_at is null)
    or (status = 'REVOKED' and revoked_at is not null))
);

create table public.recruitment_interview_participants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  interview_id uuid not null,
  participation_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, interview_id, participation_id),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, interview_id) references public.recruitment_interviews(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, participation_id) references public.recruitment_participations(tenant_id, hr_group_id, id) on delete cascade
);

create table public.recruitment_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  application_id uuid not null,
  interview_id uuid not null,
  participation_id uuid not null,
  reviewer_employee_id uuid not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED','CORRECTED')),
  revision integer not null default 1 check (revision > 0),
  submitted_at timestamptz,
  correction_reason text,
  corrected_from_assessment_id uuid,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, application_id, interview_id, reviewer_employee_id, revision),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, application_id) references public.recruitment_applications(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, interview_id) references public.recruitment_interviews(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, participation_id) references public.recruitment_participations(tenant_id, hr_group_id, id) on delete restrict,
  foreign key (tenant_id, reviewer_employee_id) references public.employees(tenant_id, id) on delete restrict,
  foreign key (tenant_id, hr_group_id, corrected_from_assessment_id) references public.recruitment_assessments(tenant_id, hr_group_id, id) on delete restrict,
  check ((status = 'DRAFT' and submitted_at is null) or (status in ('SUBMITTED','CORRECTED') and submitted_at is not null)),
  check ((status = 'CORRECTED' and corrected_from_assessment_id is not null and correction_reason is not null)
    or status <> 'CORRECTED')
);

create table public.recruitment_assessment_scores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  assessment_id uuid not null,
  characteristic_id uuid not null,
  score smallint not null check (score between 1 and 5),
  anchor_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(anchor_snapshot) = 'object'),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, assessment_id, characteristic_id),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, assessment_id) references public.recruitment_assessments(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, characteristic_id) references public.recruitment_characteristics(tenant_id, hr_group_id, id) on delete restrict
);

create table public.recruitment_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  application_id uuid,
  event_type text not null check (char_length(event_type) between 3 and 80),
  idempotency_key text,
  actor_user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, application_id) references public.recruitment_applications(tenant_id, hr_group_id, id) on delete cascade
);

create table public.recruitment_public_intake_limits (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null,
  tenant_id uuid not null,
  hr_group_id uuid not null,
  bucket_key_hash text not null check (bucket_key_hash ~ '^[a-f0-9]{64}$'),
  proof_hash text check (proof_hash is null or proof_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  verified_at timestamptz,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (publication_id, bucket_key_hash, window_started_at),
  unique (proof_hash),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, publication_id) references public.recruitment_publications(tenant_id, hr_group_id, id) on delete cascade,
  check (proof_hash is null or verified_at is not null),
  check (expires_at > window_started_at)
);

create index recruitment_candidates_normalized_email_signal_idx
  on public.recruitment_candidates(tenant_id, hr_group_id, normalized_email)
  where normalized_email is not null;
create index recruitment_pipeline_stages_active_order_idx on public.recruitment_pipeline_stages(tenant_id, hr_group_id, sort_order, id) where is_active;
create index recruitment_vacancies_scope_status_idx on public.recruitment_vacancies(tenant_id, hr_group_id, status, updated_at desc);
create index recruitment_publications_open_idx on public.recruitment_publications(id, slug) where status = 'OPEN';
create index recruitment_applications_pipeline_idx on public.recruitment_applications(tenant_id, hr_group_id, vacancy_id, active_stage_id, updated_at desc) where terminal_outcome is null;
create index recruitment_applications_retention_idx on public.recruitment_applications(tenant_id, hr_group_id, retention_due_at) where retention_due_at is not null and anonymized_at is null;
create index recruitment_documents_application_clean_idx on public.recruitment_documents(tenant_id, hr_group_id, application_id, created_at desc) where scan_status = 'CLEAN' and deleted_at is null;
create index recruitment_participations_actor_idx on public.recruitment_participations(tenant_id, hr_group_id, employee_id, application_id) where status in ('ASSIGNED','ACTIVE');
create unique index recruitment_participations_application_actor_unique_idx
  on public.recruitment_participations(tenant_id, hr_group_id, application_id, employee_id)
  where interview_id is null;
create unique index recruitment_participations_interview_actor_unique_idx
  on public.recruitment_participations(tenant_id, hr_group_id, interview_id, employee_id)
  where interview_id is not null;
create index recruitment_interviews_application_idx on public.recruitment_interviews(tenant_id, hr_group_id, application_id, scheduled_at);
create index recruitment_assessments_application_idx on public.recruitment_assessments(tenant_id, hr_group_id, application_id, interview_id, reviewer_employee_id);
create unique index recruitment_events_idempotency_idx on public.recruitment_events(application_id, idempotency_key) where idempotency_key is not null;
create index recruitment_public_intake_limits_expiry_idx on public.recruitment_public_intake_limits(expires_at) where consumed_at is null;

alter table public.recruitment_settings enable row level security;
alter table public.recruitment_pipeline_stages enable row level security;
alter table public.recruitment_vacancies enable row level security;
alter table public.recruitment_vacancy_sections enable row level security;
alter table public.recruitment_vacancy_questions enable row level security;
alter table public.recruitment_publications enable row level security;
alter table public.recruitment_candidates enable row level security;
alter table public.recruitment_applications enable row level security;
alter table public.recruitment_application_answers enable row level security;
alter table public.recruitment_documents enable row level security;
alter table public.recruitment_participations enable row level security;
alter table public.recruitment_interviews enable row level security;
alter table public.recruitment_interview_participants enable row level security;
alter table public.recruitment_library_items enable row level security;
alter table public.recruitment_library_item_states enable row level security;
alter table public.recruitment_characteristics enable row level security;
alter table public.recruitment_sets enable row level security;
alter table public.recruitment_set_items enable row level security;
alter table public.recruitment_assessments enable row level security;
alter table public.recruitment_assessment_scores enable row level security;
alter table public.recruitment_events enable row level security;
alter table public.recruitment_public_intake_limits enable row level security;

revoke all on table public.recruitment_settings from public, anon, authenticated;
revoke all on table public.recruitment_pipeline_stages from public, anon, authenticated;
revoke all on table public.recruitment_vacancies from public, anon, authenticated;
revoke all on table public.recruitment_vacancy_sections from public, anon, authenticated;
revoke all on table public.recruitment_vacancy_questions from public, anon, authenticated;
revoke all on table public.recruitment_publications from public, anon, authenticated;
revoke all on table public.recruitment_candidates from public, anon, authenticated;
revoke all on table public.recruitment_applications from public, anon, authenticated;
revoke all on table public.recruitment_application_answers from public, anon, authenticated;
revoke all on table public.recruitment_documents from public, anon, authenticated;
revoke all on table public.recruitment_participations from public, anon, authenticated;
revoke all on table public.recruitment_interviews from public, anon, authenticated;
revoke all on table public.recruitment_interview_participants from public, anon, authenticated;
revoke all on table public.recruitment_library_items from public, anon, authenticated;
revoke all on table public.recruitment_library_item_states from public, anon, authenticated;
revoke all on table public.recruitment_characteristics from public, anon, authenticated;
revoke all on table public.recruitment_sets from public, anon, authenticated;
revoke all on table public.recruitment_set_items from public, anon, authenticated;
revoke all on table public.recruitment_assessments from public, anon, authenticated;
revoke all on table public.recruitment_assessment_scores from public, anon, authenticated;
revoke all on table public.recruitment_events from public, anon, authenticated;
revoke all on table public.recruitment_public_intake_limits from public, anon, authenticated;

do $recruitment_updated_at$
declare table_name text;
begin
  foreach table_name in array array[
    'recruitment_settings','recruitment_pipeline_stages','recruitment_vacancies','recruitment_vacancy_sections',
    'recruitment_vacancy_questions','recruitment_publications','recruitment_candidates','recruitment_applications',
    'recruitment_documents','recruitment_library_items','recruitment_library_item_states','recruitment_characteristics',
    'recruitment_sets','recruitment_interviews','recruitment_participations','recruitment_assessments','recruitment_assessment_scores'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function internal_security.set_updated_at()', 'set_' || table_name || '_updated_at', table_name);
  end loop;
end
$recruitment_updated_at$;
