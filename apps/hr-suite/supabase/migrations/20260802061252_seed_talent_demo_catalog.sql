begin;

-- Idempotent Talent test fixture for the Liquid HR Demo Holding tenant.
-- All identifiers are deterministic fixture identifiers; no production-like
-- people or credentials are created by this seed.
create or replace function internal_security.normalize_talent_capability_name()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.normalized_name := lower(regexp_replace(btrim(new.name), '\\s+', ' ', 'g'));
  return new;
end;
$$;

create or replace function internal_security.audit_talent_capability_tag_relation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_data jsonb;
  old_data jsonb;
  audit_action text;
  audit_tenant uuid;
  audit_entity_id uuid;
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
    old_data := '{}'::jsonb;
    audit_action := 'DELETE';
    audit_tenant := old.tenant_id;
    audit_entity_id := md5(old.capability_id::text || ':' || old.tag_id::text)::uuid;
  else
    row_data := to_jsonb(new);
    old_data := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
    audit_action := case when tg_op = 'INSERT' then 'CREATE' else 'UPDATE' end;
    audit_tenant := new.tenant_id;
    audit_entity_id := md5(new.capability_id::text || ':' || new.tag_id::text)::uuid;
  end if;

  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (
    audit_tenant,
    'talent_capability_tags',
    audit_entity_id,
    auth.uid(),
    audit_action,
    jsonb_build_object('before', old_data, 'after', row_data)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists talent_capability_tags_audit on public.talent_capability_tags;
create trigger talent_capability_tags_audit
after insert or update or delete on public.talent_capability_tags
for each row execute function internal_security.audit_talent_capability_tag_relation();

with tenant as (
  select id
  from public.tenants
  where slug = 'liquid-hr-demo-holding'
),
tag_seed(name, is_active) as (
  values
    ('Klantgericht', true),
    ('Leiderschap', true),
    ('Samenwerking', true),
    ('Digitale kracht', true),
    ('Veilig werken', true),
    ('Veranderaar', true),
    ('Taalvaardig', true),
    ('Testdata', true),
    ('Historisch voorbeeld', false)
)
insert into public.star_performer_tags (id, tenant_id, name, is_active)
select md5('talent-demo:tag:' || tag_seed.name)::uuid, tenant.id, tag_seed.name, tag_seed.is_active
from tenant cross join tag_seed
on conflict (tenant_id, id) do update set
  name = excluded.name,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

with tenant as (
  select id
  from public.tenants
  where slug = 'liquid-hr-demo-holding'
), category_seed(code, name, description, capability_types, status) as (
  values
    ('BEHAVIOR', 'Gedrag & samenwerking', 'Observeerbaar gedrag in samenwerking, eigenaarschap en klantcontact.', array['COMPETENCY', 'SKILL', 'KNOWLEDGE']::text[], 'ACTIVE'),
    ('LEADERSHIP', 'Leiderschap', 'Leiderschap, coaching en richting geven aan teams.', array['COMPETENCY', 'SKILL', 'KNOWLEDGE']::text[], 'ACTIVE'),
    ('DELIVERY', 'Resultaat & verbeteren', 'Planning, kwaliteit, probleemoplossing en continu verbeteren.', array['COMPETENCY', 'SKILL', 'KNOWLEDGE']::text[], 'ACTIVE'),
    ('DIGITAL', 'Digitaal & data', 'Digitale vaardigheden, data en informatiebewust werken.', array['SKILL', 'KNOWLEDGE']::text[], 'ACTIVE'),
    ('LANGUAGE', 'Talen', 'Taalvaardigheid met ISO-taalcode en CEFR-niveau.', array['LANGUAGE']::text[], 'ACTIVE'),
    ('CERTIFICATE', 'Certificaten & veiligheid', 'Certificaten, veiligheid en periodieke hernieuwing.', array['CERTIFICATE']::text[], 'ACTIVE'),
    ('ARCHIVE', 'Gearchiveerde voorbeelden', 'Inactieve categorie voor status- en filtertests.', array['COMPETENCY']::text[], 'INACTIVE')
)
insert into public.talent_categories (id, tenant_id, code, name, description, capability_types, status)
select md5('talent-demo:category:' || category_seed.code)::uuid, tenant.id, category_seed.code, category_seed.name,
  category_seed.description, category_seed.capability_types, category_seed.status
from tenant cross join category_seed
on conflict (tenant_id, id) do update set
  code = excluded.code,
  name = excluded.name,
  description = excluded.description,
  capability_types = excluded.capability_types,
  status = excluded.status,
  updated_at = timezone('utc', now());

with tenant as (
  select id
  from public.tenants
  where slug = 'liquid-hr-demo-holding'
), family_seed(code, name, description, status) as (
  values
    ('TECH', 'Technology & Product', 'Productontwikkeling, platform en digitale dienstverlening.', 'ACTIVE'),
    ('PEOPLE', 'People & Culture', 'HR, organisatieontwikkeling en leren.', 'ACTIVE'),
    ('COMMERCIAL', 'Commercial', 'Sales, klantrelaties en marktontwikkeling.', 'ACTIVE'),
    ('OPERATIONS', 'Operations & Service', 'Planning, service, logistiek en uitvoering.', 'ACTIVE'),
    ('FINANCE', 'Finance & Control', 'Financiële administratie, reporting en control.', 'ACTIVE'),
    ('LEGACY', 'Legacy voorbeelden', 'Inactieve familie voor status- en archieftests.', 'INACTIVE')
)
insert into public.job_families (id, tenant_id, code, name, description, status)
select md5('talent-demo:family:' || family_seed.code)::uuid, tenant.id, family_seed.code, family_seed.name,
  family_seed.description, family_seed.status
from tenant cross join family_seed
on conflict (tenant_id, id) do update set
  code = excluded.code,
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  updated_at = timezone('utc', now());

update public.job_groups job_group
set job_family_id = family.id,
    updated_at = timezone('utc', now())
from public.job_families family
where job_group.tenant_id = family.tenant_id
  and family.tenant_id = (select id from public.tenants where slug = 'liquid-hr-demo-holding')
  and family.code = case job_group.code
    when 'J1' then 'OPERATIONS'
    when 'J2' then 'OPERATIONS'
    else family.code
  end
  and job_group.code in ('J1', 'J2');

with tenant as (
  select id
  from public.tenants
  where slug = 'liquid-hr-demo-holding'
), seniority_seed(code, name, description, sort_order, status) as (
  values
    ('LEAD', 'Lead', 'Richtinggevende vakvolwassen fase met coördinerende verantwoordelijkheid.', 4, 'ACTIVE'),
    ('PRINCIPAL', 'Principal', 'Erkend expert met organisatiebrede invloed.', 5, 'ACTIVE'),
    ('LEGACY', 'Legacy', 'Inactieve senioriteit voor status- en archieftests.', 99, 'INACTIVE')
)
insert into public.talent_seniorities (id, tenant_id, code, name, description, sort_order, status)
select md5('talent-demo:seniority:' || seniority_seed.code)::uuid, tenant.id, seniority_seed.code, seniority_seed.name,
  seniority_seed.description, seniority_seed.sort_order, seniority_seed.status
from tenant cross join seniority_seed
on conflict (tenant_id, id) do update set
  code = excluded.code,
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = timezone('utc', now());

update public.jobs job
set seniority_id = seniority.id,
    updated_at = timezone('utc', now())
from public.talent_seniorities seniority
where job.tenant_id = seniority.tenant_id
  and seniority.tenant_id = (select id from public.tenants where slug = 'liquid-hr-demo-holding')
  and seniority.code = case job.code
    when 'M1' then 'JUNIOR'
    when 'TEST-CUSTOMER' then 'MEDIOR'
    when 'TEST-MANAGER' then 'SENIOR'
    when 'TEST-PLANNER' then 'MEDIOR'
    when 'TEST-SUPERVISOR' then 'LEAD'
    when 'TEST-WAREHOUSE' then 'JUNIOR'
    else seniority.code
  end
  and job.code in ('M1', 'TEST-CUSTOMER', 'TEST-MANAGER', 'TEST-PLANNER', 'TEST-SUPERVISOR', 'TEST-WAREHOUSE');

with tenant as (
  select id
  from public.tenants
  where slug = 'liquid-hr-demo-holding'
), model as (
  select id, tenant_id
  from public.talent_level_models
  where tenant_id = (select id from tenant) and code = 'DEFAULT'
)
update public.talent_level_models level_model
set name = 'LiquidHR Talent niveaumodel',
    description = 'Testmodel met vier niveaus voor competenties, skills en kennis. Levelinhoud activeert bewust de lockguard.',
    status = 'ACTIVE',
    updated_at = timezone('utc', now())
from model
where level_model.id = model.id and level_model.tenant_id = model.tenant_id and level_model.locked_at is null;

with capability_seed(capability_type, code, name, description, category_code, status, language_code, language_cefr, language_is_native, certificate_issuing_body, certificate_validity_months, certificate_is_permanent, certificate_code, certificate_renewal_required) as (
  values
    ('COMPETENCY', 'OWNERSHIP', 'Eigenaarschap', 'Neemt verantwoordelijkheid voor afspraken, resultaat en opvolging.', 'BEHAVIOR', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('COMPETENCY', 'COLLABORATION', 'Samenwerken', 'Werkt transparant samen en maakt belangen bespreekbaar.', 'BEHAVIOR', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('COMPETENCY', 'CUSTOMER_FOCUS', 'Klantgerichtheid', 'Verbindt klantbehoefte aan passende en duurzame oplossingen.', 'BEHAVIOR', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('COMPETENCY', 'ADAPTABILITY', 'Aanpassingsvermogen', 'Blijft effectief bij verandering, onzekerheid en nieuwe werkwijzen.', 'BEHAVIOR', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('COMPETENCY', 'LEADERSHIP', 'Leiderschap', 'Geeft richting, maakt keuzes en creëert duidelijkheid.', 'LEADERSHIP', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('COMPETENCY', 'COACHING', 'Coachen', 'Helpt anderen groeien door feedback, vragen en voorbeeldgedrag.', 'LEADERSHIP', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('COMPETENCY', 'QUALITY_AWARENESS', 'Kwaliteitsbewustzijn', 'Werkt nauwkeurig en verbetert kwaliteit aantoonbaar.', 'DELIVERY', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('COMPETENCY', 'PROBLEM_SOLVING', 'Probleemoplossend vermogen', 'Analyseert oorzaken en kiest werkbare oplossingen.', 'DELIVERY', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('COMPETENCY', 'SAFETY_AWARENESS', 'Veiligheidsbewustzijn', 'Herkent risico’s en handelt volgens veilige werkwijzen.', 'DELIVERY', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('SKILL', 'STAKEHOLDER_COMMUNICATION', 'Stakeholdercommunicatie', 'Stemmen, informeren en verwachtingen managen met verschillende belanghebbenden.', 'BEHAVIOR', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('SKILL', 'PLANNING_PRIORITIZATION', 'Plannen & prioriteren', 'Maakt realistische planning en stuurt bij op risico en waarde.', 'DELIVERY', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('SKILL', 'NEGOTIATION', 'Onderhandelen', 'Bereikt heldere afspraken met oog voor relatie en resultaat.', 'BEHAVIOR', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('SKILL', 'DATA_ANALYSIS', 'Data-analyse', 'Vertaalt gegevens naar inzichten, keuzes en acties.', 'DIGITAL', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('SKILL', 'PRESENTATION', 'Presenteren', 'Brengt een boodschap helder, overtuigend en doelgroepgericht.', 'BEHAVIOR', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('SKILL', 'PROCESS_IMPROVEMENT', 'Procesverbetering', 'Brengt verspillingen in beeld en realiseert meetbare verbetering.', 'DELIVERY', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('SKILL', 'DIGITAL_TOOLS', 'Digitale tools', 'Gebruikt digitale hulpmiddelen veilig en doelgericht.', 'DIGITAL', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('SKILL', 'COACHING_CONVERSATIONS', 'Coachende gesprekken', 'Voert ontwikkel- en feedbackgesprekken met structuur en empathie.', 'LEADERSHIP', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('SKILL', 'LEGACY_SYSTEM', 'Legacy systeemgebruik', 'Historisch voorbeeld dat alleen voor filter- en archieftests behouden blijft.', 'DIGITAL', 'INACTIVE', null, null, false, null, null, false, null, false),
    ('KNOWLEDGE', 'EMPLOYMENT_LAW', 'Arbeidsrechtelijke basis', 'Kent de belangrijkste beginselen voor arbeid, contract en beëindiging.', 'LEADERSHIP', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('KNOWLEDGE', 'HR_BASICS', 'HR-basisprocessen', 'Kent de samenhang tussen medewerker, dienstverband, beleid en administratie.', 'LEADERSHIP', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('KNOWLEDGE', 'FINANCE_BASICS', 'Financiële basis', 'Begrijpt budgetten, kosten en eenvoudige managementinformatie.', 'DELIVERY', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('KNOWLEDGE', 'SUPPLY_CHAIN', 'Supply chain basis', 'Kent de keten van planning, voorraad, uitvoering en levering.', 'DELIVERY', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('KNOWLEDGE', 'DATA_PRIVACY', 'Privacy & informatiebeveiliging', 'Kent de basis voor zorgvuldig omgaan met persoonsgegevens en informatie.', 'DIGITAL', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('KNOWLEDGE', 'LIQUIDHR_PRODUCT', 'LiquidHR productkennis', 'Kent de belangrijkste HR-processen en contexten in LiquidHR.', 'DIGITAL', 'ACTIVE', null, null, false, null, null, false, null, false),
    ('LANGUAGE', 'DUTCH', 'Nederlands', 'Moedertaalniveau voor interne en externe communicatie.', 'LANGUAGE', 'ACTIVE', 'nl', null, true, null, null, false, null, false),
    ('LANGUAGE', 'ENGLISH', 'Engels', 'Werktaal voor internationale documentatie en klantcontact.', 'LANGUAGE', 'ACTIVE', 'en', 'B2', false, null, null, false, null, false),
    ('LANGUAGE', 'GERMAN', 'Duits', 'Basis werktaal voor klant- en leverancierscontact.', 'LANGUAGE', 'ACTIVE', 'de', 'A2', false, null, null, false, null, false),
    ('LANGUAGE', 'FRENCH', 'Frans', 'Werktaal voor eenvoudige klantcommunicatie.', 'LANGUAGE', 'ACTIVE', 'fr', 'B1', false, null, null, false, null, false),
    ('LANGUAGE', 'SPANISH', 'Spaans', 'Aanvullende taal voor internationale samenwerking.', 'LANGUAGE', 'ACTIVE', 'es', 'A2', false, null, null, false, null, false),
    ('CERTIFICATE', 'BHV', 'BHV', 'Bedrijfshulpverlening voor veilige incidentrespons.', 'CERTIFICATE', 'ACTIVE', null, null, false, 'NIBHV', 24, false, 'BHV-TEST', true),
    ('CERTIFICATE', 'VCA', 'VCA basis', 'Veiligheidscertificaat voor operationele werkzaamheden.', 'CERTIFICATE', 'ACTIVE', null, null, false, 'SSVV', 120, false, 'VCA-TEST', true),
    ('CERTIFICATE', 'PRINCE2', 'PRINCE2 Foundation', 'Basis certificering voor projectmatig werken.', 'CERTIFICATE', 'ACTIVE', null, null, false, 'PeopleCert', null, true, 'P2-TEST', false),
    ('CERTIFICATE', 'PRIVACY_FUNDAMENTALS', 'Privacy fundamentals', 'Interne testcertificering voor privacybewust werken.', 'CERTIFICATE', 'ACTIVE', null, null, false, 'LiquidHR Academy', 36, false, 'PRIV-TEST', true),
    ('CERTIFICATE', 'LEGACY_CERTIFICATE', 'Legacy certificaat', 'Inactief voorbeeld voor status- en filtertests.', 'CERTIFICATE', 'INACTIVE', null, null, false, 'Testinstituut', 12, false, 'LEGACY-TEST', false)
)
insert into public.talent_capabilities (
  id, tenant_id, category_id, capability_type, code, name, normalized_name, description, status,
  language_code, language_cefr, language_is_native, certificate_issuing_body,
  certificate_validity_months, certificate_is_permanent, certificate_code, certificate_renewal_required
)
select
  md5('talent-demo:capability:' || capability_seed.capability_type || ':' || capability_seed.code)::uuid,
  tenant.id,
  category.id,
  capability_seed.capability_type,
  capability_seed.code,
  capability_seed.name,
  lower(btrim(capability_seed.name)),
  capability_seed.description,
  capability_seed.status,
  capability_seed.language_code,
  capability_seed.language_cefr,
  capability_seed.language_is_native,
  capability_seed.certificate_issuing_body,
  capability_seed.certificate_validity_months,
  capability_seed.certificate_is_permanent,
  capability_seed.certificate_code,
  capability_seed.certificate_renewal_required
from public.tenants tenant
join capability_seed on true
join public.talent_categories category
  on category.tenant_id = tenant.id and category.code = capability_seed.category_code
where tenant.slug = 'liquid-hr-demo-holding'
on conflict (tenant_id, id) do update set
  category_id = excluded.category_id,
  capability_type = excluded.capability_type,
  code = excluded.code,
  name = excluded.name,
  normalized_name = excluded.normalized_name,
  description = excluded.description,
  status = excluded.status,
  language_code = excluded.language_code,
  language_cefr = excluded.language_cefr,
  language_is_native = excluded.language_is_native,
  certificate_issuing_body = excluded.certificate_issuing_body,
  certificate_validity_months = excluded.certificate_validity_months,
  certificate_is_permanent = excluded.certificate_is_permanent,
  certificate_code = excluded.certificate_code,
  certificate_renewal_required = excluded.certificate_renewal_required,
  updated_at = timezone('utc', now());

with tenant as (
  select id
  from public.tenants
  where slug = 'liquid-hr-demo-holding'
), active_dynamic_capabilities as (
  select capability.id, capability.tenant_id, capability.code, capability.name
  from public.talent_capabilities capability
  where capability.tenant_id = (select id from tenant)
    and capability.status = 'ACTIVE'
    and capability.capability_type in ('COMPETENCY', 'SKILL', 'KNOWLEDGE')
), level_rows as (
  select level.id, level.tenant_id, level.code, level.name, level.sort_order
  from public.talent_levels level
  join public.talent_level_models model on model.tenant_id = level.tenant_id and model.id = level.level_model_id
  where level.tenant_id = (select id from tenant) and model.code = 'DEFAULT'
)
insert into public.talent_capability_level_content (
  tenant_id, capability_id, talent_level_id, indicator_text, examples, coaching_notes
)
select
  capability.tenant_id,
  capability.id,
  level.id,
  format('%s werkt op %s-niveau aantoonbaar aan %s.', level.name, level.code, capability.name),
  format('Testvoorbeeld %s/%s: past dit toe in een herkenbare demo-situatie en licht de keuze toe.', capability.code, level.code),
  format('Bespreek groei op %s met een concreet voorbeeld, feedbackmoment en volgende stap.', capability.name)
from active_dynamic_capabilities capability cross join level_rows level
on conflict (tenant_id, capability_id, talent_level_id) do update set
  indicator_text = excluded.indicator_text,
  examples = excluded.examples,
  coaching_notes = excluded.coaching_notes,
  updated_at = timezone('utc', now());

with tenant as (
  select id
  from public.tenants
  where slug = 'liquid-hr-demo-holding'
), tag_relations(capability_code, tag_name) as (
  values
    ('OWNERSHIP', 'Samenwerking'),
    ('OWNERSHIP', 'Testdata'),
    ('COLLABORATION', 'Samenwerking'),
    ('CUSTOMER_FOCUS', 'Klantgericht'),
    ('LEADERSHIP', 'Leiderschap'),
    ('COACHING', 'Leiderschap'),
    ('ADAPTABILITY', 'Veranderaar'),
    ('DATA_ANALYSIS', 'Digitale kracht'),
    ('DIGITAL_TOOLS', 'Digitale kracht'),
    ('SAFETY_AWARENESS', 'Veilig werken'),
    ('BHV', 'Veilig werken'),
    ('VCA', 'Veilig werken'),
    ('DUTCH', 'Taalvaardig'),
    ('ENGLISH', 'Taalvaardig'),
    ('GERMAN', 'Taalvaardig'),
    ('FRENCH', 'Taalvaardig'),
    ('SPANISH', 'Taalvaardig'),
    ('LIQUIDHR_PRODUCT', 'Testdata'),
    ('LEGACY_SYSTEM', 'Historisch voorbeeld'),
    ('LEGACY_CERTIFICATE', 'Historisch voorbeeld')
)
insert into public.talent_capability_tags (tenant_id, capability_id, tag_id)
select tenant.id, capability.id, tag.id
from tenant
join tag_relations relation on true
join public.talent_capabilities capability
  on capability.tenant_id = tenant.id and capability.code = relation.capability_code
join public.star_performer_tags tag
  on tag.tenant_id = tenant.id and tag.name = relation.tag_name
on conflict (capability_id, tag_id) do nothing;

update public.job_profile_versions version
set status = 'ACTIVE',
    valid_from = date '2026-01-01',
    valid_until = null,
    purpose = case job.code
      when 'M1' then 'Zorgvuldig en zelfstandig uitvoeren van montagewerkzaamheden.'
      when 'TEST-CUSTOMER' then 'Klantvragen vertalen naar passende oplossingen en afspraken.'
      when 'TEST-MANAGER' then 'Teamresultaat realiseren en medewerkers laten groeien.'
      when 'TEST-PLANNER' then 'Capaciteit, planning en prioriteiten voorspelbaar organiseren.'
      when 'TEST-SUPERVISOR' then 'Veilige en efficiënte operationele uitvoering coördineren.'
      when 'TEST-WAREHOUSE' then 'Voorraad en logistieke uitvoering betrouwbaar laten verlopen.'
      else version.purpose
    end,
    summary = case job.code
      when 'M1' then 'Demo-profiel voor een uitvoerende rol met aandacht voor kwaliteit en veiligheid.'
      when 'TEST-CUSTOMER' then 'Demo-profiel voor klantcontact, analyse en communicatie.'
      when 'TEST-MANAGER' then 'Demo-profiel voor people management, coaching en arbeidsrechtelijke basis.'
      when 'TEST-PLANNER' then 'Demo-profiel voor planning, data en procesverbetering.'
      when 'TEST-SUPERVISOR' then 'Demo-profiel voor operationele aansturing en veilig werken.'
      when 'TEST-WAREHOUSE' then 'Demo-profiel voor supply chain, veiligheid en digitale registratie.'
      else version.summary
    end,
    tasks = case job.code
      when 'TEST-MANAGER' then '["teamdoelen opstellen", "ontwikkelgesprekken voeren", "capaciteit bewaken"]'::jsonb
      when 'TEST-PLANNER' then '["planning maken", "capaciteitsrisico’s signaleren", "scenario’s vergelijken"]'::jsonb
      when 'TEST-SUPERVISOR' then '["dagstart begeleiden", "veiligheidsinstructies bewaken", "kwaliteit opvolgen"]'::jsonb
      else '["werk voorbereiden", "afspraken uitvoeren", "resultaat terugkoppelen"]'::jsonb
    end,
    responsibilities = case job.code
      when 'TEST-MANAGER' then '["duidelijke verwachtingen creëren", "feedback organiseren", "besluiten vastleggen"]'::jsonb
      when 'TEST-CUSTOMER' then '["klantbehoefte verhelderen", "oplossing afstemmen", "afspraken bewaken"]'::jsonb
      else '["veilig en zorgvuldig werken", "kwaliteit bewaken", "afwijkingen melden"]'::jsonb
    end,
    result_areas = case job.code
      when 'TEST-MANAGER' then '["teamontwikkeling", "voorspelbare bezetting", "medewerkerbetrokkenheid"]'::jsonb
      when 'TEST-PLANNER' then '["betrouwbare planning", "benutte capaciteit", "tijdige bijsturing"]'::jsonb
      else '["tijdige uitvoering", "tevreden interne of externe klant", "veilige werkwijze"]'::jsonb
    end,
    updated_at = timezone('utc', now())
from public.job_profiles profile
join public.jobs job on job.tenant_id = profile.tenant_id and job.id = profile.job_id
where version.tenant_id = (select id from public.tenants where slug = 'liquid-hr-demo-holding')
  and version.job_profile_id = profile.id
  and version.version_number = 1
  and job.code in ('M1', 'TEST-CUSTOMER', 'TEST-MANAGER', 'TEST-PLANNER', 'TEST-SUPERVISOR', 'TEST-WAREHOUSE');

insert into public.job_profile_versions (
  tenant_id, job_profile_id, version_number, status, valid_from, purpose, summary
)
select
  profile.tenant_id,
  profile.id,
  2,
  'DRAFT',
  date '2027-01-01',
  'Toekomstige conceptversie voor datum- en statusfilters.',
  'Bewust niet actief: dit record ondersteunt de test van versionering en datumgeldigheid.'
from public.job_profiles profile
join public.jobs job on job.tenant_id = profile.tenant_id and job.id = profile.job_id
where profile.tenant_id = (select id from public.tenants where slug = 'liquid-hr-demo-holding')
  and job.code = 'TEST-MANAGER'
on conflict (tenant_id, job_profile_id, version_number) do update set
  status = excluded.status,
  valid_from = excluded.valid_from,
  purpose = excluded.purpose,
  summary = excluded.summary,
  updated_at = timezone('utc', now());

with requirement_seed(job_code, capability_code, requirement_type, target_level_code, language_level, certificate_details, rationale, sort_order) as (
  values
    ('M1', 'OWNERSHIP', 'REQUIRED', 'L2', null, null, 'Betrouwbare opvolging van werkafspraken.', 1),
    ('M1', 'QUALITY_AWARENESS', 'REQUIRED', 'L2', null, null, 'Kwaliteit zichtbaar controleren.', 2),
    ('M1', 'SAFETY_AWARENESS', 'REQUIRED', 'L2', null, null, 'Veilig werken is een basisvoorwaarde.', 3),
    ('M1', 'DUTCH', 'REQUIRED', null, null, null, 'Dagelijkse communicatie in het Nederlands.', 4),
    ('TEST-CUSTOMER', 'CUSTOMER_FOCUS', 'REQUIRED', 'L3', null, null, 'Klantbehoefte vertalen naar waarde.', 1),
    ('TEST-CUSTOMER', 'STAKEHOLDER_COMMUNICATION', 'REQUIRED', 'L2', null, null, 'Verwachtingen en afspraken helder maken.', 2),
    ('TEST-CUSTOMER', 'NEGOTIATION', 'PREFERRED', 'L2', null, null, 'Ruimte creëren voor passende oplossingen.', 3),
    ('TEST-CUSTOMER', 'ENGLISH', 'PREFERRED', null, 'B2', null, 'Engelstalige klantdocumentatie kunnen gebruiken.', 4),
    ('TEST-MANAGER', 'LEADERSHIP', 'REQUIRED', 'L3', null, null, 'Richting en besluitvorming voor het team.', 1),
    ('TEST-MANAGER', 'COACHING', 'REQUIRED', 'L3', null, null, 'Ontwikkeling zichtbaar en bespreekbaar maken.', 2),
    ('TEST-MANAGER', 'EMPLOYMENT_LAW', 'REQUIRED', 'L2', null, null, 'Besluiten onderbouwen binnen HR-kaders.', 3),
    ('TEST-MANAGER', 'ENGLISH', 'PREFERRED', null, 'B2', null, 'Internationale product- en HR-informatie begrijpen.', 4),
    ('TEST-PLANNER', 'PLANNING_PRIORITIZATION', 'REQUIRED', 'L3', null, null, 'Capaciteit en urgentie combineren.', 1),
    ('TEST-PLANNER', 'DATA_ANALYSIS', 'REQUIRED', 'L2', null, null, 'Planningsdata vertalen naar bijsturing.', 2),
    ('TEST-PLANNER', 'PROCESS_IMPROVEMENT', 'PREFERRED', 'L2', null, null, 'Terugkerende verstoringen structureel verbeteren.', 3),
    ('TEST-PLANNER', 'GERMAN', 'PREFERRED', null, 'A2', null, 'Eenvoudig leverancierscontact ondersteunen.', 4),
    ('TEST-SUPERVISOR', 'LEADERSHIP', 'REQUIRED', 'L2', null, null, 'Operationele richting geven tijdens de dag.', 1),
    ('TEST-SUPERVISOR', 'SAFETY_AWARENESS', 'REQUIRED', 'L3', null, null, 'Risico’s herkennen en opvolgen.', 2),
    ('TEST-SUPERVISOR', 'BHV', 'REQUIRED', null, null, '{"issuer":"NIBHV","code":"BHV-TEST"}'::jsonb, 'BHV-certificaat voor incidentrespons.', 3),
    ('TEST-SUPERVISOR', 'VCA', 'PREFERRED', null, null, '{"issuer":"SSVV","code":"VCA-TEST"}'::jsonb, 'Veiligheidsbasis voor operationele context.', 4),
    ('TEST-WAREHOUSE', 'SUPPLY_CHAIN', 'REQUIRED', 'L2', null, null, 'De logistieke keten begrijpen.', 1),
    ('TEST-WAREHOUSE', 'SAFETY_AWARENESS', 'REQUIRED', 'L2', null, null, 'Veiligheid in de dagelijkse uitvoering.', 2),
    ('TEST-WAREHOUSE', 'DIGITAL_TOOLS', 'PREFERRED', 'L1', null, null, 'Registratie en digitale overdracht.', 3),
    ('TEST-WAREHOUSE', 'BHV', 'PREFERRED', null, null, '{"issuer":"NIBHV","code":"BHV-TEST"}'::jsonb, 'Aanvullende veiligheidskwalificatie.', 4)
)
insert into public.job_profile_capability_requirements (
  tenant_id, profile_version_id, capability_id, requirement_type, target_level_id,
  language_level, certificate_details, rationale, sort_order
)
select
  profile_version.tenant_id,
  profile_version.id,
  capability.id,
  requirement_seed.requirement_type,
  target_level.id,
  requirement_seed.language_level,
  requirement_seed.certificate_details,
  requirement_seed.rationale,
  requirement_seed.sort_order
from requirement_seed
join public.jobs job
  on job.tenant_id = (select id from public.tenants where slug = 'liquid-hr-demo-holding')
  and job.code = requirement_seed.job_code
join public.job_profiles profile
  on profile.tenant_id = job.tenant_id and profile.job_id = job.id
join public.job_profile_versions profile_version
  on profile_version.tenant_id = profile.tenant_id
  and profile_version.job_profile_id = profile.id
  and profile_version.version_number = 1
join public.talent_capabilities capability
  on capability.tenant_id = job.tenant_id and capability.code = requirement_seed.capability_code
left join public.talent_levels target_level
  on target_level.tenant_id = job.tenant_id
  and target_level.code = requirement_seed.target_level_code
  and target_level.level_model_id = (select id from public.talent_level_models where tenant_id = job.tenant_id and code = 'DEFAULT')
on conflict (tenant_id, profile_version_id, capability_id) do update set
  requirement_type = excluded.requirement_type,
  target_level_id = excluded.target_level_id,
  language_level = excluded.language_level,
  certificate_details = excluded.certificate_details,
  rationale = excluded.rationale,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

update public.employee_organizations organization
set job_title = revision.name,
    updated_at = timezone('utc', now())
from public.jobs job
left join lateral (
  select name
  from public.job_revisions revision
  where revision.tenant_id = job.tenant_id and revision.job_id = job.id
  order by revision.valid_from desc nulls last, revision.updated_at desc
  limit 1
) revision on true
where organization.tenant_id = (select id from public.tenants where slug = 'liquid-hr-demo-holding')
  and organization.job_id = job.id;

commit;
