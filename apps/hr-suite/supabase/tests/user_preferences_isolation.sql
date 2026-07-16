begin;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
values
  (
    md5('auth-user:preferences-one')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'voorkeur-een@liquid-demo.invalid',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    false,
    false
  ),
  (
    md5('auth-user:preferences-two')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'voorkeur-twee@liquid-demo.invalid',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    false,
    false
  )
on conflict (id) do nothing;

insert into public.user_preferences (auth_user_id, locale, theme)
values
  (md5('auth-user:preferences-one')::uuid, 'nl', 'liquid-navy'),
  (md5('auth-user:preferences-two')::uuid, 'en', 'nacht');

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', md5('auth-user:preferences-one')::uuid,
    'role', 'authenticated',
    'email', 'voorkeur-een@liquid-demo.invalid'
  )::text,
  true
);

set local role authenticated;

do $$
begin
  if (select count(*) from public.user_preferences) <> 1 then
    raise exception 'Voorkeurisolatie faalt: verwacht exact de eigen voorkeuren.';
  end if;

  update public.user_preferences
  set theme = 'bos'
  where auth_user_id = md5('auth-user:preferences-two')::uuid;

  if found then
    raise exception 'Voorkeurisolatie faalt: voorkeuren van een andere gebruiker zijn gewijzigd.';
  end if;

  begin
    insert into public.user_preferences (auth_user_id, locale, theme)
    values (md5('auth-user:preferences-two')::uuid, 'nl', 'bos')
    on conflict (auth_user_id) do update set theme = excluded.theme;
    raise exception 'Voorkeurisolatie faalt: schrijven voor een andere gebruiker is toegestaan.';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

rollback;
