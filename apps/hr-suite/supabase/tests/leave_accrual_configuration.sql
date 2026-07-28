begin;

do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.leave_accrual_basis'::regtype
      and enumlabel = 'AGE_SENIORITY'
  ) then
    raise exception 'AGE_SENIORITY ontbreekt in leave_accrual_basis.';
  end if;

  if (select count(*) from information_schema.columns
      where table_schema = 'public'
        and table_name = 'leave_types'
        and column_name in (
          'allow_limit_overrun', 'pin_in_calendar', 'requires_manager_approval',
          'notify_manager_on_request', 'requires_manager_approval_on_cancellation'
        )) <> 5 then
    raise exception 'Algemene verloftype-instellingen ontbreken.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.leave_accrual_rules'::regclass
      and conname = 'leave_accrual_rules_amount_valid'
  ) then
    raise exception 'Constraint voor opbouwbasis ontbreekt.';
  end if;

  if not exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'create_leave_accrual_rule'
  ) then
    raise exception 'Successor-RPC ontbreekt.';
  end if;

  if not exists (select 1 from pg_type where oid = 'public.leave_bonus_trigger_type'::regtype)
     or not exists (select 1 from pg_type where oid = 'public.leave_bonus_award_timing'::regtype) then
    raise exception 'Bonus-triggerenums ontbreken.';
  end if;

  if not exists (select 1 from pg_class where oid = 'public.leave_bonus_rules'::regclass and relrowsecurity)
     or not exists (select 1 from pg_class where oid = 'public.leave_bonus_tiers'::regclass and relrowsecurity) then
    raise exception 'RLS ontbreekt op bonusregels of bonustreden.';
  end if;

  if pg_get_constraintdef((select oid from pg_constraint where conrelid = 'public.leave_accrual_rules'::regclass and conname = 'leave_accrual_rules_amount_valid')) like '%AGE_SENIORITY%' then
    raise exception 'AGE_SENIORITY mag geen gewone opbouwregel meer zijn.';
  end if;

  if not exists (select 1 from pg_class where oid = 'public.leave_types'::regclass and relrowsecurity)
     or not exists (select 1 from pg_class where oid = 'public.leave_accrual_rules'::regclass and relrowsecurity) then
    raise exception 'RLS ontbreekt op verloftypen of opbouwregels.';
  end if;
end;
$$;

rollback;
