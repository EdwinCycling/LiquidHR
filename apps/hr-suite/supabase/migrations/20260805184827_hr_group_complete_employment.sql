do $$ begin
  if to_regprocedure('public.publish_complete_employment(uuid,uuid,jsonb)') is null then
    raise exception 'STAP6_COMPLETE_EMPLOYMENT_FUNCTION_MISSING';
  end if;
end $$;