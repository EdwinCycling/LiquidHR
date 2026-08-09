begin;

-- Publieke wrappers blijven security-invoker. Hun private helpers zijn niet via
-- PostgREST geëxposeerd, maar hebben wel authenticated EXECUTE nodig om door de
-- wrapper te kunnen worden aangeroepen. De helpers blijven zelf scope- en
-- actor-geautoriseerd; anon krijgt geen recht.
grant execute on function internal_security.claim_workflow_job(uuid) to authenticated;
grant execute on function internal_security.finish_workflow_job(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function internal_security.requeue_workflow_job(uuid) to authenticated;
grant execute on function internal_security.create_process_deadline_reminder(uuid, text) to authenticated;
grant execute on function internal_security.begin_process_output(uuid, text) to authenticated;
grant execute on function internal_security.attach_process_output_document(uuid, text, text, text, bigint, text, text, text) to authenticated;
grant execute on function internal_security.complete_process_output(uuid, text, uuid) to authenticated;
grant execute on function internal_security.get_process_output_projection(uuid, text) to authenticated;
grant execute on function internal_security.get_process_automation_operations(uuid) to authenticated;
grant execute on function internal_security.add_process_output_document_audiences(uuid) to authenticated;
grant execute on function internal_security.get_process_work_projection(uuid, text, text, text, uuid, uuid, text, text, integer, integer) to authenticated;
grant execute on function internal_security.get_process_work_item_detail(uuid, text) to authenticated;
grant execute on function internal_security.get_process_work_projection_with_administration(uuid, uuid, text, text, text, uuid, uuid, text, text, integer, integer) to authenticated;
grant execute on function internal_security.get_process_output_download_context(uuid, uuid) to authenticated;

commit;
