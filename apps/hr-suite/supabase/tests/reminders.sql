begin;

insert into public.user_access (
  user_id, tenant_id, management_role_id, scope_type, administration_id
)
select
  actor.id,
  md5('tenant:liquid-hr-demo-holding')::uuid,
  role.id,
  'TENANT',
  null
from auth.users actor
join public.management_roles role on role.code = 'TENANT_ADMIN' and role.tenant_id is null
where lower(actor.email) = 'edwin@editsolutions.nl'
on conflict do nothing;

insert into public.reminders (
  id, tenant_id, administration_id, created_by_user_id, reminder_type,
  target_type, title, remind_at, status
)
select
  md5('reminder:foreign-tenant')::uuid,
  md5('tenant:noorderlicht-zorggroep')::uuid,
  null,
  actor.id,
  'HR',
  'EVERYONE',
  'Niet zichtbaar in andere tenant',
  timezone('utc', now()) + interval '2 days',
  'DRAFT'
from auth.users actor
where lower(actor.email) = 'edwin@editsolutions.nl';

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select id from auth.users where lower(email) = 'edwin@editsolutions.nl' limit 1),
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

do $$
declare
  tenant uuid := md5('tenant:liquid-hr-demo-holding')::uuid;
  administration uuid;
  actor uuid;
  personal_reminder uuid;
  personal_recipient uuid;
  hr_reminder uuid;
  recipient_count integer;
begin
  select id into administration
  from public.administrations
  where tenant_id = tenant
  order by code
  limit 1;

  actor := auth.uid();

  personal_reminder := public.create_personal_reminder(
    tenant,
    administration,
    'Persoonlijke testreminder',
    'Alleen zichtbaar voor de eigenaar.',
    timezone('utc', now()) + interval '1 day'
  );

  select id into personal_recipient
  from public.reminder_recipients
  where reminder_id = personal_reminder;

  if personal_recipient is null
    or (select count(*) from public.reminder_recipients where reminder_id = personal_reminder and user_id = actor) <> 1 then
    raise exception 'Persoonlijke reminder heeft niet exact één eigen recipient.';
  end if;

  perform public.update_personal_reminder(
    personal_reminder,
    'Bijgewerkte persoonlijke testreminder',
    null,
    timezone('utc', now()) + interval '3 days'
  );

  if not exists (
    select 1 from public.reminder_recipients
    where id = personal_recipient
      and effective_remind_at > timezone('utc', now()) + interval '2 days'
  ) then
    raise exception 'De recipienttijd is niet atomair met de persoonlijke reminder bijgewerkt.';
  end if;

  perform public.update_reminder_recipient(
    personal_recipient,
    'COMPLETE',
    null
  );

  if (select status from public.reminder_recipients where id = personal_recipient) <> 'COMPLETED' then
    raise exception 'Gereedmelden van de eigen reminder is mislukt.';
  end if;

  hr_reminder := public.create_hr_reminder(
    tenant,
    administration,
    'HR-testreminder',
    null,
    timezone('utc', now()) + interval '4 days',
    'EVERYONE',
    '{}'::uuid[]
  );
  recipient_count := public.publish_reminder(hr_reminder);

  if recipient_count < 1
    or (select status from public.reminders where id = hr_reminder) <> 'PUBLISHED'
    or (select count(*) from public.reminder_recipients where reminder_id = hr_reminder) <> recipient_count then
    raise exception 'Atomaire HR-publicatie of doelgroepmaterialisatie is mislukt.';
  end if;

  if exists (
    select 1 from public.reminders
    where id = md5('reminder:foreign-tenant')::uuid
  ) then
    raise exception 'Cross-tenant reminder is zichtbaar.';
  end if;

  begin
    update public.reminder_recipients
    set user_id = gen_random_uuid()
    where id = personal_recipient;
    raise exception 'Recipient-identiteit kon worden gewijzigd.';
  exception
    when insufficient_privilege or check_violation then null;
  end;
end
$$;

rollback;
