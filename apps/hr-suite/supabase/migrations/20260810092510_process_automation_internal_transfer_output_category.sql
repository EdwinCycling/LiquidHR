insert into public.document_categories (
  tenant_id,
  administration_id,
  code,
  name,
  description
)
select
  administration.tenant_id,
  administration.id,
  'process-internal-transfer',
  'Procesuitvoer interne overplaatsing',
  'Automatisch gegenereerde procesuitvoer van interne overplaatsingen.'
from public.administrations administration
where administration.is_active
on conflict (tenant_id, administration_id, code) do nothing;