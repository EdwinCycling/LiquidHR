begin;

alter table public.user_invitations
  drop constraint user_invitations_purpose_valid;

alter table public.user_invitations
  add constraint user_invitations_purpose_valid
  check (
    (
      purpose in ('PREBOARDING_EMPLOYEE', 'EMPLOYEE_ACTIVATION')
      and email_kind = 'PRIVATE'
      and employee_id is not null
    )
    or (
      purpose = 'BUSINESS_USER'
      and email_kind = 'BUSINESS'
    )
  );

commit;
