begin;

-- Exposed organisatie-tabellen zijn uitsluitend via de authenticated-rol
-- bereikbaar; RLS blijft daarnaast de HR-groepsgrens afdwingen.
revoke all on public.administration_company_data from anon, public;
revoke all on public.administration_locations from anon, public;
grant select, insert, update, delete on public.administration_company_data to authenticated;
grant select, insert, update, delete on public.administration_locations to authenticated;

commit;
