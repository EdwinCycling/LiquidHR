-- D01 follow-up: avoid recursive category/document RLS evaluation.
create or replace function internal_security.employee_has_accessible_document_category(
  requested_category_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.employee_documents document
    where document.category_id = requested_category_id
      and document.employee_id = internal_security.current_employee_id()
      and internal_security.can_access_document(document.id, 'document:read')
  );
$function$;

revoke all on function internal_security.employee_has_accessible_document_category(uuid) from public, anon, authenticated;
grant execute on function internal_security.employee_has_accessible_document_category(uuid) to authenticated;

drop policy if exists document_categories_self_document_read on public.document_categories;
drop policy if exists document_categories_read on public.document_categories;
create policy document_categories_read
on public.document_categories for select to authenticated
using (
  (
    (select internal_security.current_user_has_permission(tenant_id, administration_id, 'document:read'))
    and (
      not requires_salary_permission
      or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:read'))
    )
  )
  or (select internal_security.employee_has_accessible_document_category(id))
);
