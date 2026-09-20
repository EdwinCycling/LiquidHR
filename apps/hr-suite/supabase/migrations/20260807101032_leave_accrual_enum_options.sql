alter type public.leave_type_entitlement_mode add value if not exists 'ANNUAL_HOURS_FTE_CAP';
alter type public.leave_type_entitlement_mode add value if not exists 'OVERTIME_HOURS';
alter type public.leave_accrual_frequency add value if not exists 'FOUR_WEEKLY';
alter type public.leave_accrual_frequency add value if not exists 'MONTHLY';