begin;

-- De bestaande employees-tabel gebruikt bewust kolomrechten. De nieuwe
-- HR-groepkolom moet daarom expliciet worden toegevoegd aan de veilige lees-
-- en insertprojectie; een gebruiker mag de groepskoppeling nooit wijzigen.
grant select (hr_group_id) on public.employees to authenticated;
grant insert (hr_group_id) on public.employees to authenticated;

commit;
