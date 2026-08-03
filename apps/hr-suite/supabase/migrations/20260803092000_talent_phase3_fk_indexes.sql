create index if not exists talent_goal_check_ins_author_user_idx
  on public.talent_goal_check_ins (author_user_id);

create index if not exists talent_notifications_recipient_employee_fk_idx
  on public.talent_notifications (tenant_id, recipient_employee_id);
