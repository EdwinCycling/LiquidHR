begin;

-- SEC-010: internal process wrappers are callable by the authenticated
-- application role only. The three recruitment_public_* functions remain
-- intentionally callable by anon and are not changed here.
revoke execute on function public.get_process_recipe_catalog() from public, anon;
grant execute on function public.get_process_recipe_catalog() to authenticated;

revoke execute on function public.get_process_recipe_start_context(uuid, uuid, text) from public, anon;
grant execute on function public.get_process_recipe_start_context(uuid, uuid, text) to authenticated;

revoke execute on function public.activate_process_recipe(uuid, uuid, uuid, public.access_scope_type, uuid, text) from public, anon;
grant execute on function public.activate_process_recipe(uuid, uuid, uuid, public.access_scope_type, uuid, text) to authenticated;

revoke execute on function public.get_internal_transfer_preview(uuid) from public, anon;
grant execute on function public.get_internal_transfer_preview(uuid) to authenticated;

revoke execute on function public.commit_internal_transfer(uuid, bigint, bigint, text, uuid) from public, anon;
grant execute on function public.commit_internal_transfer(uuid, bigint, bigint, text, uuid) to authenticated;

revoke execute on function public.request_process_work_item_changes(uuid, bigint, bigint, text, uuid, text) from public, anon;
grant execute on function public.request_process_work_item_changes(uuid, bigint, bigint, text, uuid, text) to authenticated;

commit;
