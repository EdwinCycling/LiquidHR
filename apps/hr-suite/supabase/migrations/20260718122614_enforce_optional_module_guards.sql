create policy ai_conversations_module_enabled on public.ai_conversations as restrictive for all to authenticated
using ((select internal_security.tenant_module_enabled(tenant_id,'HERA')))
with check ((select internal_security.tenant_module_enabled(tenant_id,'HERA')));
create policy ai_messages_module_enabled on public.ai_messages as restrictive for all to authenticated
using ((select internal_security.tenant_module_enabled(tenant_id,'HERA')))
with check ((select internal_security.tenant_module_enabled(tenant_id,'HERA')));
create policy ai_memory_items_module_enabled on public.ai_memory_items as restrictive for all to authenticated
using ((select internal_security.tenant_module_enabled(tenant_id,'HERA')))
with check ((select internal_security.tenant_module_enabled(tenant_id,'HERA')));
create policy ai_action_drafts_module_enabled on public.ai_action_drafts as restrictive for all to authenticated
using ((select internal_security.tenant_module_enabled(tenant_id,'HERA')))
with check ((select internal_security.tenant_module_enabled(tenant_id,'HERA')));
create policy ai_user_preferences_module_enabled on public.ai_user_preferences as restrictive for all to authenticated
using ((select internal_security.tenant_module_enabled(tenant_id,'HERA')))
with check ((select internal_security.tenant_module_enabled(tenant_id,'HERA')));

create policy employee_documents_module_enabled on public.employee_documents as restrictive for all to authenticated
using ((select internal_security.tenant_module_enabled(tenant_id,'DOCUMENTS')))
with check ((select internal_security.tenant_module_enabled(tenant_id,'DOCUMENTS')));
create policy document_audiences_module_enabled on public.document_audiences as restrictive for all to authenticated
using ((select internal_security.tenant_module_enabled(tenant_id,'DOCUMENTS')))
with check ((select internal_security.tenant_module_enabled(tenant_id,'DOCUMENTS')));

create policy reminders_module_enabled on public.reminders as restrictive for all to authenticated
using ((select internal_security.tenant_module_enabled(tenant_id,'REMINDERS')))
with check ((select internal_security.tenant_module_enabled(tenant_id,'REMINDERS')));
create policy reminder_targets_module_enabled on public.reminder_targets as restrictive for all to authenticated
using ((select internal_security.tenant_module_enabled(tenant_id,'REMINDERS')))
with check ((select internal_security.tenant_module_enabled(tenant_id,'REMINDERS')));
create policy reminder_recipients_module_enabled on public.reminder_recipients as restrictive for all to authenticated
using ((select internal_security.tenant_module_enabled(tenant_id,'REMINDERS')))
with check ((select internal_security.tenant_module_enabled(tenant_id,'REMINDERS')));
create policy reminder_target_rules_module_enabled on public.reminder_target_rules as restrictive for all to authenticated
using ((select internal_security.tenant_module_enabled(tenant_id,'REMINDERS')))
with check ((select internal_security.tenant_module_enabled(tenant_id,'REMINDERS')));
