update public.employment_end_reasons
set
  is_active = false,
  updated_at = timezone('utc', now())
where country_code = 'NL'
  and code not in ('01', '02', '03', '04', '20', '21', '30', '32', '33', '34', '40', '41', '90', '99');
