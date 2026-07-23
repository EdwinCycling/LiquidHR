insert into public.leave_year_controls (tenant_id, administration_id, year, status)
select '07249eb9-545c-883b-b26b-d52f83b4f4a1'::uuid, '2057f6ec-cd3e-3c28-9126-c41235d4ffae'::uuid, year_value, 'ACTIVE'
from (values (2026::smallint), (2027::smallint)) as years(year_value)
on conflict (tenant_id, administration_id, year) do nothing;
