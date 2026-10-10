-- Reconciles the Core/DEV migration recorded at 20261008062756.
-- Schema and constraints were read back from project wnpfloqpjvaacobppbpk.
-- This file is repository history only; it is not to be re-applied to Core/DEV.

CREATE TABLE public.pension_arrangements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  hr_group_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  arrangement_type text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  transition_date date,
  grandfathering_mode text NOT NULL DEFAULT 'NONE'::text,
  flat_total_rate numeric(7, 4),
  employer_share_pct numeric(7, 4) NOT NULL,
  employee_share_pct numeric(7, 4) NOT NULL,
  annual_franchise numeric(12, 2) NOT NULL,
  annual_pensionable_salary_cap numeric(12, 2),
  pensionable_salary_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  eligibility_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pension_arrangements_scope_code_key UNIQUE (tenant_id, hr_group_id, administration_id, code),
  CONSTRAINT pension_arrangements_arrangement_type_check CHECK (arrangement_type = ANY (ARRAY['FLAT_PREMIUM'::text, 'PROGRESSIVE_PREMIUM'::text])),
  CONSTRAINT pension_arrangements_effective_dates_chk CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT pension_arrangements_flat_rate_chk CHECK (
    (arrangement_type = 'FLAT_PREMIUM'::text AND flat_total_rate IS NOT NULL AND flat_total_rate >= 0)
    OR (arrangement_type = 'PROGRESSIVE_PREMIUM'::text AND flat_total_rate IS NULL)
  ),
  CONSTRAINT pension_arrangements_grandfathering_mode_check CHECK (grandfathering_mode = ANY (ARRAY['NONE'::text, 'EERBIEDIGENDE_WERKING'::text])),
  CONSTRAINT pension_arrangements_split_chk CHECK (abs((employer_share_pct + employee_share_pct) - 100.0000) < 0.0001)
);

CREATE TABLE public.pension_arrangement_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  hr_group_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  pension_arrangement_id uuid NOT NULL REFERENCES public.pension_arrangements(id) ON DELETE CASCADE,
  min_age smallint NOT NULL,
  max_age smallint NOT NULL,
  total_rate numeric(7, 4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pension_arrangement_tiers_age_chk CHECK (min_age >= 0 AND max_age >= min_age),
  CONSTRAINT pension_arrangement_tiers_rate_chk CHECK (total_rate >= 0),
  CONSTRAINT pension_arrangement_tiers_unique_band UNIQUE (pension_arrangement_id, min_age, max_age)
);

CREATE TABLE public.labor_condition_pension_arrangements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  hr_group_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  labor_condition_set_id uuid NOT NULL REFERENCES public.labor_condition_sets(id),
  pension_arrangement_id uuid NOT NULL REFERENCES public.pension_arrangements(id),
  participant_group text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT labor_condition_pension_arrangements_dates_chk CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT labor_condition_pension_arrangements_participant_group_check CHECK (participant_group = ANY (ARRAY['NEW_ENTRANT'::text, 'GRANDFATHERED'::text])),
  CONSTRAINT labor_condition_pension_arrangements_unique UNIQUE (labor_condition_set_id, pension_arrangement_id, participant_group, effective_from)
);

CREATE TABLE public.employment_pension_arrangement_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  hr_group_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  employment_id uuid NOT NULL REFERENCES public.employments(id),
  pension_arrangement_id uuid NOT NULL REFERENCES public.pension_arrangements(id),
  participation_start_date date NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  assignment_reason text NOT NULL,
  provenance_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employment_pension_assignments_dates_chk CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT employment_pension_assignments_unique UNIQUE (employment_id, pension_arrangement_id, effective_from)
);

ALTER TABLE public.pension_arrangements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pension_arrangement_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_condition_pension_arrangements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employment_pension_arrangement_assignments ENABLE ROW LEVEL SECURITY;

-- Match the grants read back on Core/DEV; RLS remains the row-level gate.
GRANT ALL PRIVILEGES ON TABLE public.pension_arrangements TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE public.pension_arrangement_tiers TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE public.labor_condition_pension_arrangements TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE public.employment_pension_arrangement_assignments TO anon, authenticated, service_role;
