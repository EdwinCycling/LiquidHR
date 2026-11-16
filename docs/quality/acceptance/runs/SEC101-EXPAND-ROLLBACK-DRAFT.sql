-- Uitsluitend nadat alle nieuwe applicatieruntimes zijn teruggedraaid.
BEGIN;
DROP FUNCTION public.sec101_profile_metadata(uuid[]);
DROP FUNCTION public.sec101_provenance_key_fingerprint();
DROP TABLE internal_security.sec101_provenance_public_key;
COMMIT;
