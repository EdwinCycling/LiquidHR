begin;

grant execute on function internal_security.start_process(uuid, uuid, uuid, date, text, uuid) to authenticated;
grant execute on function internal_security.perform_process_work_item_action(uuid, text, bigint, bigint, text, uuid) to authenticated;
grant execute on function internal_security.get_process_instance_projection(uuid) to authenticated;
grant execute on function internal_security.get_process_form_projection(uuid, text) to authenticated;
grant execute on function internal_security.save_process_form_response(uuid, bigint, bigint, jsonb, text, uuid, text) to authenticated;

commit;
