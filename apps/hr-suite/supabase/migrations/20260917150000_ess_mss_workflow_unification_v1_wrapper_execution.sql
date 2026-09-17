begin;

-- De publieke wrappers blijven security-invoker, net als de bestaande Process
-- Automation wrappers. De private helpers zijn niet via PostgREST zichtbaar,
-- maar hebben authenticated EXECUTE nodig om vanuit die wrappers te lopen.
grant execute on function internal_security.calculate_leave_workflow_minutes(
  uuid, uuid, uuid, uuid, date, date, public.leave_request_time_mode, time, time
) to authenticated;

grant execute on function internal_security.leave_workflow_type_ids(
  uuid, uuid, uuid, public.leave_request_mode, uuid, uuid, date, date
) to authenticated;

grant execute on function internal_security.start_leave_request_workflow_internal(
  uuid, uuid, uuid, uuid, uuid, public.leave_request_mode, uuid, uuid, date, date,
  public.leave_request_time_mode, time, time, text, uuid
) to authenticated;

grant execute on function internal_security.book_leave_request_workflow(uuid, uuid)
  to authenticated;

grant execute on function internal_security.perform_leave_workflow_action_internal(
  uuid, text, bigint, bigint, text, uuid, text
) to authenticated;

grant execute on function internal_security.get_unified_process_work_projection(
  uuid, text, text, text, text, text, text, uuid, uuid, uuid, uuid, text, text, integer, integer
) to authenticated;

grant execute on function internal_security.get_unified_process_work_item_detail(uuid, text)
  to authenticated;

commit;
