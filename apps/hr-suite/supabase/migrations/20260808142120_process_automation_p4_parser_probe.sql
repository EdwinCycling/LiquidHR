begin;
create or replace function internal_security.p4_parser_probe() returns integer language plpgsql security definer set search_path = '' as $$ begin return 1; end; $$;
drop function internal_security.p4_parser_probe();
commit;