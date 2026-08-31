# Supabase typegen drift

## Status

Read-only typegen was run on 2026-08-31 against canonical Supabase project `wnpfloqpjvaacobppbpk`, from the maintenance candidate based on `origin/main` `fad1a115b496c1d4e0c211953930b272dde22e4c`. No remote schema, migration history, data, grants, or policies were changed.

## Evidence

- Remote generated output: 635,722 characters and 258 `public.Tables` entries.
- Checked-in `packages/db/types.ts`: 659,998 characters and 262 `public.Tables` entries.
- Remote-only table: `saved_analysis_definitions`.
- Local-only tables: `company_activities`, `dashboard_widget_configs`, `dashboard_widget_role_access`, `personal_dashboard_widgets`, and `personal_dashboards`.
- The local generator header reports PostgREST `14.17`; the current remote typegen output reports PostgREST `14.5`. The output is therefore not a safe whole-file replacement for this candidate.

## Decision

The missing `saved_analysis_definitions` type is a current, deterministic addition introduced by the migration already present in the repository and registered remotely under the different version `20260831093310`. The five local-only dashboard tables are older unrelated drift and were not removed. A broad generated-types replacement would silently delete those local contracts and could change unrelated enum, function, relationship, or view definitions.

The candidate applies only the exact `saved_analysis_definitions` `Row`, `Insert`, `Update`, and relationship block to `packages/db/types.ts`. The saved-analysis service retains its existing narrow server-only persistence seam and explicit tenant, HR-group, owner, and permission checks; this type-only sync does not broaden runtime access or authorization.

## Future normalization

When a dedicated typegen maintenance run is approved, capture local and remote generator metadata first, then compare tables, views, functions, enums, composite types, and relationships by named blocks. Resolve the five dashboard removals and any additional differences against schema/catalog evidence before replacing the generated file. Do not overwrite the file wholesale, remove local contracts, apply migrations, or mutate the remote database as part of a quality-gate run.
