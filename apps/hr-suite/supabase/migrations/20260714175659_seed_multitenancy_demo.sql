delete from public.department_management;
delete from public.employee_organizations;
delete from public.employee_administration_assignments;
delete from public.user_access;
delete from public.departments;
delete from public.administrations;
delete from public.employees;
delete from public.tenants;

insert into public.tenants (
  id,
  name,
  slug,
  administration_mode,
  sharing_mode
)
values
  (
    md5('tenant:liquid-hr-demo-holding')::uuid,
    'Liquid HR Demo Holding',
    'liquid-hr-demo-holding',
    'SEPARATE',
    'FULLY_ISOLATED'
  ),
  (
    md5('tenant:noorderlicht-zorggroep')::uuid,
    'Noorderlicht Zorggroep',
    'noorderlicht-zorggroep',
    'SEPARATE',
    'FULLY_ISOLATED'
  );

insert into public.administrations (
  id,
  tenant_id,
  parent_id,
  code,
  name,
  coc_number,
  vat_number
)
values
  (
    md5('administration:liquid-holding')::uuid,
    md5('tenant:liquid-hr-demo-holding')::uuid,
    null,
    'HOLDING',
    'Liquid HR Demo Holding B.V.',
    '90000001',
    'NL009000001B01'
  ),
  (
    md5('administration:liquid-services')::uuid,
    md5('tenant:liquid-hr-demo-holding')::uuid,
    md5('administration:liquid-holding')::uuid,
    'SERVICES',
    'Liquid HR Services B.V.',
    '90000002',
    'NL009000002B01'
  ),
  (
    md5('administration:liquid-operations')::uuid,
    md5('tenant:liquid-hr-demo-holding')::uuid,
    md5('administration:liquid-holding')::uuid,
    'OPERATIONS',
    'Liquid HR Operations B.V.',
    '90000003',
    'NL009000003B01'
  ),
  (
    md5('administration:noorderlicht-care')::uuid,
    md5('tenant:noorderlicht-zorggroep')::uuid,
    null,
    'CARE',
    'Noorderlicht Zorg B.V.',
    '91000001',
    'NL009100001B01'
  );

insert into public.departments (
  id,
  tenant_id,
  administration_id,
  parent_id,
  code,
  name,
  description
)
values
  (md5('department:HOLDING:BOARD')::uuid, md5('tenant:liquid-hr-demo-holding')::uuid, md5('administration:liquid-holding')::uuid, null, 'BOARD', 'Directie', 'Bestuur en concernleiding.'),
  (md5('department:HOLDING:FIN')::uuid, md5('tenant:liquid-hr-demo-holding')::uuid, md5('administration:liquid-holding')::uuid, md5('department:HOLDING:BOARD')::uuid, 'FIN', 'Finance & Control', 'Financiën en concerncontrol.'),
  (md5('department:HOLDING:HR')::uuid, md5('tenant:liquid-hr-demo-holding')::uuid, md5('administration:liquid-holding')::uuid, md5('department:HOLDING:BOARD')::uuid, 'HR', 'People & Culture', 'HR-beleid en organisatieontwikkeling.'),
  (md5('department:SERVICES:ROOT')::uuid, md5('tenant:liquid-hr-demo-holding')::uuid, md5('administration:liquid-services')::uuid, null, 'ROOT', 'Services', 'Directie van de dienstenorganisatie.'),
  (md5('department:SERVICES:IT')::uuid, md5('tenant:liquid-hr-demo-holding')::uuid, md5('administration:liquid-services')::uuid, md5('department:SERVICES:ROOT')::uuid, 'IT', 'Digital & IT', 'Softwareontwikkeling en IT-beheer.'),
  (md5('department:SERVICES:CONSULT')::uuid, md5('tenant:liquid-hr-demo-holding')::uuid, md5('administration:liquid-services')::uuid, md5('department:SERVICES:ROOT')::uuid, 'CONSULT', 'Consultancy', 'HR- en implementatieconsultants.'),
  (md5('department:SERVICES:SALES')::uuid, md5('tenant:liquid-hr-demo-holding')::uuid, md5('administration:liquid-services')::uuid, md5('department:SERVICES:ROOT')::uuid, 'SALES', 'Sales & Marketing', 'Commercie en marktontwikkeling.'),
  (md5('department:OPERATIONS:ROOT')::uuid, md5('tenant:liquid-hr-demo-holding')::uuid, md5('administration:liquid-operations')::uuid, null, 'ROOT', 'Operations', 'Directie van de operationele organisatie.'),
  (md5('department:OPERATIONS:LOG')::uuid, md5('tenant:liquid-hr-demo-holding')::uuid, md5('administration:liquid-operations')::uuid, md5('department:OPERATIONS:ROOT')::uuid, 'LOG', 'Logistiek', 'Planning en logistieke uitvoering.'),
  (md5('department:OPERATIONS:CS')::uuid, md5('tenant:liquid-hr-demo-holding')::uuid, md5('administration:liquid-operations')::uuid, md5('department:OPERATIONS:ROOT')::uuid, 'CS', 'Customer Service', 'Klantcontact en service.'),
  (md5('department:OPERATIONS:FAC')::uuid, md5('tenant:liquid-hr-demo-holding')::uuid, md5('administration:liquid-operations')::uuid, md5('department:OPERATIONS:ROOT')::uuid, 'FAC', 'Facility', 'Facilitaire dienstverlening.'),
  (md5('department:CARE:ROOT')::uuid, md5('tenant:noorderlicht-zorggroep')::uuid, md5('administration:noorderlicht-care')::uuid, null, 'ROOT', 'Zorgdirectie', 'Bestuur van de zorgorganisatie.'),
  (md5('department:CARE:NURSE')::uuid, md5('tenant:noorderlicht-zorggroep')::uuid, md5('administration:noorderlicht-care')::uuid, md5('department:CARE:ROOT')::uuid, 'NURSE', 'Verpleging', 'Verpleegkundige zorgteams.'),
  (md5('department:CARE:TREAT')::uuid, md5('tenant:noorderlicht-zorggroep')::uuid, md5('administration:noorderlicht-care')::uuid, md5('department:CARE:ROOT')::uuid, 'TREAT', 'Behandeling', 'Paramedische behandeling.'),
  (md5('department:CARE:PLAN')::uuid, md5('tenant:noorderlicht-zorggroep')::uuid, md5('administration:noorderlicht-care')::uuid, md5('department:CARE:ROOT')::uuid, 'PLAN', 'Planning', 'Capaciteits- en personeelsplanning.');

with source as (
  select
    number,
    (array['Edwin','Sophie','Daan','Nora','Bram','Lina','Milan','Yara','Lucas','Sara','Finn','Maya','Sem','Eva','Noah','Lotte','Omar','Julia','Timo','Aylin'])[((number - 1) % 20) + 1] as first_name,
    (array['Testbeheerder','De Vries','Jansen','Smit','Van Dijk','Bakker','Visser','Meijer','De Boer','Mulder','De Groot','Bos','Vos','Peters','Hendriks','Dekker','Kaya','Van Leeuwen','Martens','El Amrani'])[((number - 1) % 20) + 1] as last_name,
    (array['Amsterdam','Rotterdam','Utrecht','Amersfoort','Haarlem','Leiden','Delft','Eindhoven','Breda','Zwolle'])[((number - 1) % 10) + 1] as city
  from generate_series(1, 50) number
)
insert into public.employees (
  id,
  employee_number,
  initials,
  first_name,
  birth_name,
  name_usage,
  gender,
  pronouns,
  birth_date,
  birth_place,
  birth_country,
  nationality,
  marital_status,
  education_level,
  preferred_language,
  private_email,
  private_phone,
  private_mobile,
  work_email,
  work_phone,
  work_phone_ext,
  work_mobile,
  original_hire_date,
  custom_fields,
  tenant_id
)
select
  md5('employee:demo:' || number)::uuid,
  'DEMO-' || lpad(number::text, 3, '0'),
  left(first_name, 1) || left(last_name, 1),
  first_name,
  last_name,
  'BIRTH_NAME',
  case when number % 2 = 0 then 'FEMALE'::public.gender else 'MALE'::public.gender end,
  case when number % 2 = 0 then 'zij/haar' else 'hij/hem' end,
  date '1970-01-01' + ((number * 337) % 10000),
  city,
  'Nederland',
  'Nederlands',
  case when number % 4 = 0 then 'MARRIED'::public.marital_status else 'SINGLE'::public.marital_status end,
  (array['MBO','HBO','WO','HIGHSCHOOL']::public.education_level[])[((number - 1) % 4) + 1],
  'nl',
  lower(first_name || '.' || replace(last_name, ' ', '')) || number || '@example.invalid',
  '+31 20 ' || lpad((1000000 + number)::text, 7, '0'),
  '+31 6 ' || lpad((10000000 + number)::text, 8, '0'),
  case when number = 1 then 'edwin@editsolutions.nl' else lower(first_name || '.' || replace(last_name, ' ', '')) || '@liquid-demo.invalid' end,
  '+31 20 ' || lpad((2000000 + number)::text, 7, '0'),
  lpad((100 + number)::text, 4, '0'),
  '+31 6 ' || lpad((20000000 + number)::text, 8, '0'),
  date '2012-01-01' + (number * 43),
  jsonb_build_object(
    'address', jsonb_build_object(
      'street', (array['Lindelaan','Stationsweg','Kerkstraat','Parklaan','Havenstraat'])[((number - 1) % 5) + 1],
      'houseNumber', number + 10,
      'postcode', lpad((1000 + number)::text, 4, '0') || ' AB',
      'city', city,
      'country', 'Nederland'
    ),
    'seedProfile', 'liquid-hr-demo',
    'emergencyContact', jsonb_build_object('name', 'Contactpersoon ' || number, 'phone', '+31 6 ' || lpad((30000000 + number)::text, 8, '0'))
  ),
  md5('tenant:liquid-hr-demo-holding')::uuid
from source;

with source as (
  select
    number,
    (array['Anne','Mohammed','Iris','Ruben','Fatima','Jesse','Kim','Ravi','Eline','Thomas'])[number] as first_name,
    (array['Van den Berg','Ait Taleb','Verhoeven','Kuiper','Öztürk','Willems','Hoekstra','Sharma','Prins','Koster'])[number] as last_name,
    (array['Groningen','Assen','Drachten','Leeuwarden','Hoogeveen'])[((number - 1) % 5) + 1] as city
  from generate_series(1, 10) number
)
insert into public.employees (
  id,
  employee_number,
  initials,
  first_name,
  birth_name,
  name_usage,
  gender,
  pronouns,
  birth_date,
  birth_place,
  birth_country,
  nationality,
  marital_status,
  education_level,
  preferred_language,
  private_email,
  private_phone,
  private_mobile,
  work_email,
  work_phone,
  work_phone_ext,
  work_mobile,
  original_hire_date,
  custom_fields,
  tenant_id
)
select
  md5('employee:noorderlicht:' || number)::uuid,
  'NZG-' || lpad(number::text, 3, '0'),
  left(first_name, 1) || left(last_name, 1),
  first_name,
  last_name,
  'BIRTH_NAME',
  case when number % 2 = 0 then 'MALE'::public.gender else 'FEMALE'::public.gender end,
  case when number % 2 = 0 then 'hij/hem' else 'zij/haar' end,
  date '1975-01-01' + ((number * 521) % 9000),
  city,
  'Nederland',
  'Nederlands',
  case when number % 3 = 0 then 'MARRIED'::public.marital_status else 'SINGLE'::public.marital_status end,
  (array['MBO','HBO','WO']::public.education_level[])[((number - 1) % 3) + 1],
  'nl',
  lower(first_name || '.' || replace(last_name, ' ', '')) || '@example.invalid',
  '+31 50 ' || lpad((4000000 + number)::text, 7, '0'),
  '+31 6 ' || lpad((40000000 + number)::text, 8, '0'),
  lower(first_name || '.' || replace(last_name, ' ', '')) || '@noorderlicht.invalid',
  '+31 50 ' || lpad((5000000 + number)::text, 7, '0'),
  lpad((500 + number)::text, 4, '0'),
  '+31 6 ' || lpad((50000000 + number)::text, 8, '0'),
  date '2017-01-01' + (number * 61),
  jsonb_build_object(
    'address', jsonb_build_object(
      'street', (array['Zorglaan','Noorderweg','Esdoornstraat','Westerkade','Schoolstraat'])[((number - 1) % 5) + 1],
      'houseNumber', number + 20,
      'postcode', lpad((9300 + number)::text, 4, '0') || ' CD',
      'city', city,
      'country', 'Nederland'
    ),
    'seedProfile', 'noorderlicht-demo',
    'emergencyContact', jsonb_build_object('name', 'Noodcontact ' || number, 'phone', '+31 6 ' || lpad((60000000 + number)::text, 8, '0'))
  ),
  md5('tenant:noorderlicht-zorggroep')::uuid
from source;

update public.employees employee
set auth_user_id = auth_user.id
from auth.users auth_user
where employee.employee_number = 'DEMO-001'
  and lower(auth_user.email) = 'edwin@editsolutions.nl';

create temporary table seed_employee_scope on commit drop as
select
  employee.id as employee_id,
  employee.tenant_id,
  case
    when substring(employee.employee_number from 6)::integer between 1 and 5 then md5('administration:liquid-holding')::uuid
    when substring(employee.employee_number from 6)::integer between 6 and 27 then md5('administration:liquid-services')::uuid
    else md5('administration:liquid-operations')::uuid
  end as administration_id,
  case
    when substring(employee.employee_number from 6)::integer = 1 then md5('department:HOLDING:BOARD')::uuid
    when substring(employee.employee_number from 6)::integer between 2 and 5 and substring(employee.employee_number from 6)::integer % 2 = 0 then md5('department:HOLDING:FIN')::uuid
    when substring(employee.employee_number from 6)::integer between 2 and 5 then md5('department:HOLDING:HR')::uuid
    when substring(employee.employee_number from 6)::integer = 6 then md5('department:SERVICES:ROOT')::uuid
    when substring(employee.employee_number from 6)::integer between 7 and 27 and substring(employee.employee_number from 6)::integer % 3 = 0 then md5('department:SERVICES:IT')::uuid
    when substring(employee.employee_number from 6)::integer between 7 and 27 and substring(employee.employee_number from 6)::integer % 3 = 1 then md5('department:SERVICES:CONSULT')::uuid
    when substring(employee.employee_number from 6)::integer between 7 and 27 then md5('department:SERVICES:SALES')::uuid
    when substring(employee.employee_number from 6)::integer = 28 then md5('department:OPERATIONS:ROOT')::uuid
    when substring(employee.employee_number from 6)::integer % 3 = 0 then md5('department:OPERATIONS:LOG')::uuid
    when substring(employee.employee_number from 6)::integer % 3 = 1 then md5('department:OPERATIONS:CS')::uuid
    else md5('department:OPERATIONS:FAC')::uuid
  end as department_id,
  case
    when substring(employee.employee_number from 6)::integer = 1 then null
    when substring(employee.employee_number from 6)::integer between 2 and 5 then md5('employee:demo:1')::uuid
    when substring(employee.employee_number from 6)::integer = 6 then null
    when substring(employee.employee_number from 6)::integer between 7 and 27 then md5('employee:demo:6')::uuid
    when substring(employee.employee_number from 6)::integer = 28 then null
    else md5('employee:demo:28')::uuid
  end as direct_manager_id,
  case
    when substring(employee.employee_number from 6)::integer in (1, 6, 28) then 'Directeur'
    when substring(employee.employee_number from 6)::integer % 7 = 0 then 'Teamleider'
    when substring(employee.employee_number from 6)::integer between 7 and 27 then (array['Software engineer','HR-consultant','Implementatieconsultant','Accountmanager'])[((substring(employee.employee_number from 6)::integer - 1) % 4) + 1]
    when substring(employee.employee_number from 6)::integer >= 29 then (array['Logistiek planner','Servicemedewerker','Facilitair coördinator'])[((substring(employee.employee_number from 6)::integer - 1) % 3) + 1]
    else 'Concernspecialist'
  end as job_title,
  'CC-' || lpad(substring(employee.employee_number from 6), 3, '0') as cost_bearer
from public.employees employee
where employee.tenant_id = md5('tenant:liquid-hr-demo-holding')::uuid

union all

select
  employee.id,
  employee.tenant_id,
  md5('administration:noorderlicht-care')::uuid,
  case
    when substring(employee.employee_number from 5)::integer = 1 then md5('department:CARE:ROOT')::uuid
    when substring(employee.employee_number from 5)::integer % 3 = 0 then md5('department:CARE:NURSE')::uuid
    when substring(employee.employee_number from 5)::integer % 3 = 1 then md5('department:CARE:TREAT')::uuid
    else md5('department:CARE:PLAN')::uuid
  end,
  case when substring(employee.employee_number from 5)::integer = 1 then null else md5('employee:noorderlicht:1')::uuid end,
  case
    when substring(employee.employee_number from 5)::integer = 1 then 'Zorgdirecteur'
    when substring(employee.employee_number from 5)::integer % 3 = 0 then 'Verpleegkundige'
    when substring(employee.employee_number from 5)::integer % 3 = 1 then 'Behandelaar'
    else 'Personeelsplanner'
  end,
  'ZORG-' || lpad(substring(employee.employee_number from 5), 3, '0')
from public.employees employee
where employee.tenant_id = md5('tenant:noorderlicht-zorggroep')::uuid;

insert into public.employee_administration_assignments (
  tenant_id,
  administration_id,
  employee_id,
  effective_from
)
select tenant_id, administration_id, employee_id, date '2024-01-01'
from seed_employee_scope;

insert into public.employee_organizations (
  tenant_id,
  administration_id,
  employee_id,
  department_id,
  direct_manager_id,
  job_title,
  cost_bearer,
  effective_from
)
select
  tenant_id,
  administration_id,
  employee_id,
  department_id,
  direct_manager_id,
  job_title,
  cost_bearer,
  date '2024-01-01'
from seed_employee_scope;

insert into public.department_management (
  tenant_id,
  administration_id,
  department_id,
  management_role_id,
  employee_id,
  effective_from
)
select seed.tenant_id, seed.administration_id, seed.department_id, role.id, seed.employee_id, date '2024-01-01'
from (
  values
    (md5('tenant:liquid-hr-demo-holding')::uuid, md5('administration:liquid-holding')::uuid, md5('department:HOLDING:BOARD')::uuid, md5('employee:demo:1')::uuid),
    (md5('tenant:liquid-hr-demo-holding')::uuid, md5('administration:liquid-services')::uuid, md5('department:SERVICES:ROOT')::uuid, md5('employee:demo:6')::uuid),
    (md5('tenant:liquid-hr-demo-holding')::uuid, md5('administration:liquid-operations')::uuid, md5('department:OPERATIONS:ROOT')::uuid, md5('employee:demo:28')::uuid),
    (md5('tenant:noorderlicht-zorggroep')::uuid, md5('administration:noorderlicht-care')::uuid, md5('department:CARE:ROOT')::uuid, md5('employee:noorderlicht:1')::uuid)
) as seed(tenant_id, administration_id, department_id, employee_id)
join public.management_roles role
  on role.code = 'DIRECT_MANAGER'
 and role.tenant_id is null;

insert into public.user_access (
  user_id,
  tenant_id,
  management_role_id,
  scope_type
)
select
  auth_user.id,
  md5('tenant:liquid-hr-demo-holding')::uuid,
  role.id,
  'TENANT'
from auth.users auth_user
join public.management_roles role
  on role.code = 'TENANT_ADMIN'
 and role.tenant_id is null
where lower(auth_user.email) = 'edwin@editsolutions.nl';

do $$
begin
  if (select count(*) from public.tenants) <> 2 then
    raise exception 'De demo-seed verwacht exact twee tenants.';
  end if;
  if (select count(*) from public.administrations) <> 4 then
    raise exception 'De demo-seed verwacht exact vier administraties.';
  end if;
  if (select count(*) from public.employees) <> 60 then
    raise exception 'De demo-seed verwacht exact zestig medewerkers.';
  end if;
  if (select count(*) from public.employee_administration_assignments where effective_to is null) <> 60 then
    raise exception 'Iedere demomedewerker moet een actieve administratiekoppeling hebben.';
  end if;
  if (select count(*) from public.employee_organizations where effective_to is null) <> 60 then
    raise exception 'Iedere demomedewerker moet een actieve organisatieplaatsing hebben.';
  end if;
  if (
    select count(*)
    from public.user_access access
    join auth.users auth_user on auth_user.id = access.user_id
    where lower(auth_user.email) = 'edwin@editsolutions.nl'
      and access.tenant_id = md5('tenant:liquid-hr-demo-holding')::uuid
      and access.scope_type = 'TENANT'
      and access.is_active
  ) <> 1 then
    raise exception 'Edwin moet exact één actieve tenantbrede demo-toegang hebben.';
  end if;
end
$$;
