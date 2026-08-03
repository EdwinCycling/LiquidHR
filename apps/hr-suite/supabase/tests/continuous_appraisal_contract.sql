do $$
declare
  table_name text;
begin
  foreach table_name in array array['continuous_appraisal_items', 'continuous_appraisal_item_comments', 'continuous_appraisal_attachments'] loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Missing Continuous Appraisal table: %', table_name;
    end if;
    if not exists (
      select 1 from pg_class
      where oid = to_regclass('public.' || table_name)
        and relrowsecurity
    ) then
      raise exception 'RLS is disabled on %', table_name;
    end if;
    if has_table_privilege('anon', 'public.' || table_name, 'SELECT')
      or has_table_privilege('public', 'public.' || table_name, 'SELECT') then
      raise exception 'Anonymous/public SELECT grant exists on %', table_name;
    end if;
  end loop;

  if not exists (select 1 from public.permissions where code = 'continuous-appraisal:manage')
    or not exists (select 1 from public.permissions where code = 'continuous-appraisal:read')
    or not exists (select 1 from public.permissions where code = 'continuous-appraisal:write')
    or not exists (select 1 from public.permissions where code = 'self:continuous-appraisal:read')
    or not exists (select 1 from public.permissions where code = 'self:continuous-appraisal:write') then
    raise exception 'Continuous Appraisal permissions are missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.continuous_appraisal_item_comments'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) ilike '%item_id%continuous_appraisal_items%'
  ) then
    raise exception 'Comment to item foreign key is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'continuous_appraisal_items'
      and policyname = 'continuous_appraisal_items_select'
      and qual ilike '%current_employee_id%'
  ) then
    raise exception 'Self/manager item select policy is missing';
  end if;

  if not has_function_privilege('authenticated', 'internal_security.current_employee_id()', 'EXECUTE') then
    raise exception 'Authenticated security helper access is missing';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'continuous-appraisal-attachments'
      and public = false
      and allowed_mime_types @> array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']::text[]
  ) then
    raise exception 'Continuous Appraisal attachment bucket is not private or fully configured';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'continuous_appraisal_objects_read'
  ) then
    raise exception 'Continuous Appraisal storage read policy is missing';
  end if;
end;
$$;
