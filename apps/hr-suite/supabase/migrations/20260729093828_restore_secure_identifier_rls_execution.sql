-- De RLS-policies op de afgeschermde BSN-tabel roepen deze helpers aan.
-- De functies staan buiten het blootgestelde public-schema en controleren zelf
-- de canonieke medewerker-BSN-rechten.
grant execute on function internal_security.employee_secure_identifier_can_read(uuid, uuid)
to authenticated;
grant execute on function internal_security.employee_secure_identifier_can_write(uuid, uuid)
to authenticated;
