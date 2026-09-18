-- A normal employee/ESS activation is distinct from the future-start flow.
-- Keep both purposes explicit so the employment timeline remains authoritative.
alter type public.invitation_purpose
  add value if not exists 'EMPLOYEE_ACTIVATION';
