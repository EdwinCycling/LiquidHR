-- Toegepast 2026-09-30 na expliciete toestemming van Edwin. Uitsluitend LiquidHR-Payroll-Lab
-- project jhgeriucbkfarxiudzfy. Geen Core-write of permissionwijziging.
-- Opaque scope-ID's van de bestaande Test HR Admin-context Planeten.
-- Persoonsgegevens, credentials, werknemer- en salarisbrondata ontbreken.
-- Alleen de drie expliciet toegestane testcontext-koppelingen.
insert into public.payroll_administrations
  (source_tenant_id, source_hr_group_id, source_administration_id,
   display_name, capability_enabled, status)
values
  ('07249eb9-545c-883b-b26b-d52f83b4f4a1',
   '6ba6f1df-e376-40f2-abff-ffdf000172e1',
   '2057f6ec-cd3e-3c28-9126-c41235d4ffae',
   'PAYLAB GC-NL-001 — Mars BV', true, 'ACTIVE'),
  ('07249eb9-545c-883b-b26b-d52f83b4f4a1',
   '6ba6f1df-e376-40f2-abff-ffdf000172e1',
   '8483abc9-f275-c80b-5a23-fedc54ce9f0a',
   'PAYLAB GC-NL-001 — Jupiter BV', true, 'ACTIVE'),
  ('07249eb9-545c-883b-b26b-d52f83b4f4a1',
   '6ba6f1df-e376-40f2-abff-ffdf000172e1',
   '6ebc1932-8af5-0bf3-ae5e-05bb7b1bfb1f',
   'PAYLAB GC-NL-001 — Mercurius BV', true, 'ACTIVE')
on conflict (source_tenant_id, source_hr_group_id, source_administration_id)
do nothing;
