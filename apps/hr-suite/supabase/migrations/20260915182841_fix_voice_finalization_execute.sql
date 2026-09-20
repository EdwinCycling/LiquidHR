begin;

-- The public RPC is server-only. Its SECURITY INVOKER setting meant service_role
-- could not call the deliberately revoked internal accounting function (Postgres 42501).
alter function public.finalize_ai_voice_session(uuid, uuid, uuid, text, uuid, text, integer, integer, text, text)
  security definer;
alter function public.finalize_ai_voice_session(uuid, uuid, uuid, text, uuid, text, integer, integer, text, text)
  set search_path = pg_catalog, public, internal_security, pg_temp;

revoke all on function public.finalize_ai_voice_session(uuid, uuid, uuid, text, uuid, text, integer, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.finalize_ai_voice_session(uuid, uuid, uuid, text, uuid, text, integer, integer, text, text)
  to service_role;

commit;