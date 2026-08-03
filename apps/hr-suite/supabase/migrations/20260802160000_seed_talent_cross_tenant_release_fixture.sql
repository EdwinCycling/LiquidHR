begin;

-- Niet-productieve fixture voor de cross-tenant-negatieve release-test.
insert into public.talent_capabilities (
  id,
  tenant_id,
  category_id,
  capability_type,
  code,
  name,
  normalized_name,
  description,
  status,
  language_code,
  language_cefr,
  language_is_native,
  certificate_issuing_body,
  certificate_validity_months,
  certificate_is_permanent,
  certificate_code,
  certificate_renewal_required
)
select
  md5('talent-cross-tenant:capability:release-negative')::uuid,
  tenant.id,
  null,
  'COMPETENCY',
  'CROSS_TENANT_NEGATIVE_TEST',
  'Cross-tenant negatieve testcompetentie',
  'cross-tenant negatieve testcompetentie',
  'Uitsluitend testdata voor tenantisolatie en release-gatevalidatie.',
  'ACTIVE',
  null,
  null,
  false,
  null,
  null,
  false,
  null,
  false
from public.tenants tenant
where tenant.slug = 'noorderlicht-zorggroep'
on conflict (tenant_id, code) do update set
  name = excluded.name,
  normalized_name = excluded.normalized_name,
  description = excluded.description,
  status = excluded.status,
  updated_at = timezone('utc', now());

commit;
