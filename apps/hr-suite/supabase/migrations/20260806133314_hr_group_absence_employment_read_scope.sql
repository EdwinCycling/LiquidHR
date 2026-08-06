begin;

-- Een manager met absence:write moet de bevestigde employmentkeuzes kunnen lezen
-- die nodig zijn om een ziekmelding veilig aan één dienstverband te koppelen.
create policy employments_select_absence_write
on public.employments for select to authenticated
using (
  record_status = 'CONFIRMED'
  and deleted_at is null
  and (select internal_security.can_manage_employee(employee_id, 'absence:write'))
);

commit;
