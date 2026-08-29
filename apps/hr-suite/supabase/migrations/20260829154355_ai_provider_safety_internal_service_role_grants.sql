grant execute on function internal_security.reserve_ai_provider_execution(
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  boolean
) to service_role;

grant execute on function internal_security.complete_ai_provider_execution(
  uuid,
  uuid
) to service_role;
