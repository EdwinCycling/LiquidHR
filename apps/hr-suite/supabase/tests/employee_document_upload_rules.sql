begin;

do $$
declare
  allowed_types text[];
begin
  select allowed_mime_types into allowed_types
  from storage.buckets
  where id = 'employee-documents';

  if allowed_types is null
     or not allowed_types @> array['application/pdf', 'text/plain', 'application/msword', 'image/jpeg', 'image/bmp'] then
    raise exception 'De toegestane documenttypes zijn niet volledig geconfigureerd.';
  end if;

  if 'image/png' = any(allowed_types) then
    raise exception 'PNG mag niet meer als dossieruploadtype zijn toegestaan.';
  end if;
end $$;

rollback;
