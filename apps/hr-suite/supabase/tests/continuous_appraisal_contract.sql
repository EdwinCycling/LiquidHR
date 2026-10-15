do $$
declare
  target_table_name text;
begin
  foreach target_table_name in array array['continuous_appraisal_items', 'continuous_appraisal_item_comments', 'continuous_appraisal_attachments'] loop
    if to_regclass('public.' || target_table_name) is null then
      raise exception 'Missing Continuous Appraisal table: %', target_table_name;
    end if;
    if not exists (
      select 1 from pg_class
      where oid = to_regclass('public.' || target_table_name)
        and relrowsecurity
    ) then
      raise exception 'RLS is disabled on %', target_table_name;
    end if;
    if has_table_privilege('anon', 'public.' || target_table_name, 'SELECT')
      or has_table_privilege('public', 'public.' || target_table_name, 'SELECT') then
      raise exception 'Anonymous/public SELECT grant exists on %', target_table_name;
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

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.continuous_appraisal_items'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%NOT_RELEVANT%'
  ) then
    raise exception 'NOT_RELEVANT status is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.audit_logs'::regclass
      and conname = 'audit_logs_action_check'
      and pg_get_constraintdef(oid) ilike '%STATUS_TRANSITION%'
      and pg_get_constraintdef(oid) ilike '%SOFT_DELETE%'
  ) then
    raise exception 'Continuous Appraisal audit actions are not allowed';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'continuous_appraisal_items' and column_name = 'deleted_at')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'continuous_appraisal_items' and column_name = 'deleted_by_user_id') then
    raise exception 'Soft-delete provenance columns are missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'continuous_appraisal_items'
      and policyname = 'continuous_appraisal_items_not_deleted'
      and permissive = 'RESTRICTIVE'
      and qual ilike '%deleted_at IS NULL%'
  ) then
    raise exception 'Soft-deleted items are not restricted from reads';
  end if;

  if has_table_privilege('authenticated', 'public.continuous_appraisal_items', 'DELETE')
    or has_table_privilege('authenticated', 'public.continuous_appraisal_items', 'TRUNCATE')
    or has_column_privilege('authenticated', 'public.continuous_appraisal_items', 'deleted_at', 'UPDATE')
    or has_column_privilege('authenticated', 'public.continuous_appraisal_items', 'deleted_by_user_id', 'UPDATE')
    or has_column_privilege('authenticated', 'public.continuous_appraisal_items', 'item_status', 'UPDATE') then
    raise exception 'Direct delete/status/provenance update privilege exists';
  end if;

  if has_table_privilege('anon', 'public.continuous_appraisal_items', 'DELETE')
    or has_table_privilege('anon', 'public.continuous_appraisal_items', 'TRUNCATE') then
    raise exception 'Anonymous destructive table privilege exists';
  end if;

  if not has_table_privilege('service_role', 'public.continuous_appraisal_items', 'DELETE')
    or not has_table_privilege('service_role', 'public.continuous_appraisal_items', 'TRUNCATE') then
    raise exception 'Required service_role maintenance privileges are missing';
  end if;

  if not has_function_privilege('authenticated', 'public.transition_continuous_appraisal_item_status(uuid,integer,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.soft_delete_continuous_appraisal_item(uuid,integer)', 'EXECUTE')
    or has_function_privilege('anon', 'public.transition_continuous_appraisal_item_status(uuid,integer,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.soft_delete_continuous_appraisal_item(uuid,integer)', 'EXECUTE') then
    raise exception 'Transition/soft-delete RPC grants are incorrect';
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
