alter table public.employment_end_reasons
  add column country_code text not null default 'NL';

alter table public.employment_end_reasons
  add constraint employment_end_reasons_country_code_check
    check (country_code ~ '^[A-Z]{2}$');

alter table public.employment_end_reasons
  drop constraint employment_end_reasons_code_key;

alter table public.employment_end_reasons
  add constraint employment_end_reasons_country_code_key
    unique (tenant_id, administration_id, country_code, code);

create index employment_end_reasons_country_active_idx
  on public.employment_end_reasons (
    tenant_id,
    administration_id,
    country_code,
    is_active,
    code
  );

insert into public.employment_end_reasons (
  tenant_id,
  administration_id,
  country_code,
  code,
  name_nl,
  name_en,
  is_active
)
select
  administration.tenant_id,
  administration.id,
  'NL',
  reason.code,
  reason.name_nl,
  reason.name_en,
  true
from public.administrations administration
cross join (
  values
    ('01', 'Opzegging door de werkgever binnen de proeftijd', 'Termination by the employer during the probationary period'),
    ('02', 'Opzegging door de werkgever met toestemming van UWV', 'Termination by the employer with permission from UWV'),
    ('03', 'Ontbinding door rechter op verzoek van de werkgever', 'Dissolution by the court at the employer''s request'),
    ('04', 'Beëindiging arbeidsovereenkomst met wederzijds goedvinden op initiatief van de werkgever', 'Termination by mutual consent at the employer''s initiative'),
    ('20', 'Einde arbeidsovereenkomst door opzegging werknemer, door toedoen werknemer of op initiatief van de werknemer', 'End of employment following employee resignation, employee action or employee initiative'),
    ('21', 'Opzegging door werkgever om dringende reden (ontslag op staande voet)', 'Immediate dismissal by the employer for urgent cause'),
    ('30', 'Einde van rechtswege vanwege verstrijken duur arbeidsovereenkomst voor bepaalde tijd', 'Automatic end when a fixed-term employment contract expires'),
    ('32', 'Einde van rechtswege vanwege pensionering', 'Automatic end due to retirement'),
    ('33', 'Einde van rechtswege vanwege overlijden', 'Automatic end due to death'),
    ('34', 'Einde van rechtswege, om een andere reden (intreden ontbindende voorwaarde, e.d.)', 'Automatic end for another reason, such as a resolutive condition'),
    ('40', 'Einde uitzendovereenkomst, inroepen uitzendbeding door inlener vanwege ziekte uitzendkracht', 'End of agency contract after the hirer invokes the agency clause due to sickness'),
    ('41', 'Einde uitzendovereenkomst, inroepen uitzendbeding door inlener om een andere reden', 'End of agency contract after the hirer invokes the agency clause for another reason'),
    ('90', 'De arbeidsovereenkomst loopt door, maar de inkomstenverhouding is administratief beëindigd', 'Employment continues, but the income relationship is administratively ended'),
    ('99', 'Een andere, hiervoor niet genoemde reden', 'Another reason not listed above')
) as reason(code, name_nl, name_en)
on conflict (tenant_id, administration_id, country_code, code)
do update set
  name_nl = excluded.name_nl,
  name_en = excluded.name_en,
  is_active = true,
  updated_at = timezone('utc', now());
