begin;

alter function public.create_document_studio_template_draft(
  uuid, uuid, text, public.document_studio_template_kind, public.document_studio_language,
  text, text, uuid, public.document_studio_category, boolean, uuid, jsonb, jsonb, jsonb, uuid, text
) security definer;

alter function public.save_document_studio_template_draft(
  uuid, integer, text, text, uuid, public.document_studio_category, boolean, uuid, jsonb, jsonb, jsonb, uuid, text
) security definer;

alter function public.create_document_studio_draft_from_active(uuid, uuid, text) security definer;

alter function public.validate_document_studio_template_draft(uuid, integer, text, jsonb) security definer;

alter function public.activate_document_studio_template_draft(uuid, integer, uuid, text) security definer;

alter function public.archive_document_studio_template(uuid, uuid, text) security definer;

alter function public.discard_document_studio_template_draft(uuid, uuid, text) security definer;

alter function public.retire_document_studio_asset(uuid) security definer;

alter function public.replace_document_studio_template_tags(uuid, jsonb) security definer;

commit;
