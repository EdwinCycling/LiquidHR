create or replace function public.publish_recruitment_vacancy(
  requested_vacancy_id uuid,
  requested_status text,
  requested_slug text,
  requested_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare vacancy public.recruitment_vacancies%rowtype;
declare publication public.recruitment_publications%rowtype;
declare publication_id uuid;
begin
  select * into vacancy from public.recruitment_vacancies where id = requested_vacancy_id for update;
  if not found then raise exception 'RECRUITMENT_VACANCY_NOT_FOUND' using errcode = 'P0002'; end if;
  perform internal_recruitment.require_vacancy_scope(vacancy.tenant_id, vacancy.hr_group_id, 'recruitment-vacancy:publish');
  if requested_status not in ('OPEN','CLOSED','ARCHIVED') then raise exception 'RECRUITMENT_PUBLICATION_STATUS_INVALID' using errcode = '22023'; end if;
  if requested_status = 'OPEN' and (requested_slug is null or requested_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$') then raise exception 'RECRUITMENT_PUBLICATION_SLUG_INVALID' using errcode = '22023'; end if;
  update public.recruitment_vacancies set status = case when requested_status = 'OPEN' then 'ACTIVE' when requested_status = 'ARCHIVED' then 'ARCHIVED' else status end, version = version + 1, updated_by_user_id = (select auth.uid()) where id = vacancy.id;
  select * into publication from public.recruitment_publications where tenant_id = vacancy.tenant_id and hr_group_id = vacancy.hr_group_id and vacancy_id = vacancy.id for update;
  if not found then
    insert into public.recruitment_publications (tenant_id, hr_group_id, vacancy_id, slug, status, published_title, published_location, published_payload, opened_at, closed_at, archived_at)
    values (vacancy.tenant_id, vacancy.hr_group_id, vacancy.id, coalesce(requested_slug, 'vacancy-' || left(vacancy.id::text, 8)), requested_status, vacancy.title, vacancy.location_label, coalesce(requested_payload, '{}'::jsonb), case when requested_status = 'OPEN' then timezone('utc', now()) else null end, case when requested_status = 'CLOSED' then timezone('utc', now()) else null end, case when requested_status = 'ARCHIVED' then timezone('utc', now()) else null end)
    returning id into publication_id;
  else
    update public.recruitment_publications set
      slug = coalesce(requested_slug, publication.slug), status = requested_status, published_title = vacancy.title,
      published_location = vacancy.location_label, published_payload = coalesce(requested_payload, publication.published_payload),
      opened_at = case when requested_status = 'OPEN' then coalesce(publication.opened_at, timezone('utc', now())) else publication.opened_at end,
      closed_at = case when requested_status = 'CLOSED' then timezone('utc', now()) else null end,
      archived_at = case when requested_status = 'ARCHIVED' then timezone('utc', now()) else null end,
      version = publication.version + 1, updated_at = timezone('utc', now())
    where id = publication.id returning id into publication_id;
  end if;
  return jsonb_build_object('id', publication_id, 'status', requested_status, 'slug', coalesce(requested_slug, publication.slug));
end;
$$;
