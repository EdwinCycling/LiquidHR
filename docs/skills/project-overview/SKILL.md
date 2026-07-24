---
name: project-overview
description: Produce a reproducible project overview with code KPIs, API and UI routes, database schema and live record counts, quality status, references, and a transparent traditional-coding mandays comparison. Use for project overview, code metrics, database inventory, delivery status, or effort estimation.
---

# Project overview

Maak een actuele, controleerbare projectinventaris. Lees eerst `AGENTS.md`, `docs/README.md` en `docs/delivery/CURRENT_CONTEXT.md`.

## Workflow

1. Noteer peildatum, branch, laatste commit, applicatieversie en werkboomstatus.
2. Draai vanuit de repositoryroot `docs/skills/project-overview/scripts/collect_local_metrics.ps1`.
3. Rapporteer productiecode afzonderlijk van tests, documentatie, migraties en gegenereerde types.
4. Tel echte `page.tsx`/`page.ts`-routes en `app/api/**/route.ts`-handlers; tel geen mappen als routes.
5. Gebruik Supabase-MCP voor live tabellen, records, databasegrootte en advisors. Lees alleen aggregaten en metadaten; toon nooit recordinhoud, secrets, tokens of persoonsgegevens.
6. Als MCP/auth ontbreekt, meld `niet beschikbaar` met de blokkade. Gebruik geen lokale seeds als live recordaantallen.
7. Voeg absolute lokale referenties en de exacte peildatum toe.
8. Schat traditionele inspanning als bandbreedte per werkpakket: analyse/domein, schema/RLS, API, UI, tests/documentatie/release. Noem dit equivalentie, geen timesheet.

## Vereiste output

1. Momentopname.
2. Code-KPI's: bestanden, LOC, productiecode, tests, componenten, services, routes.
3. API/UI-overzicht.
4. Database: tabellen, views, functions, migraties, RLS, policies, indexes, live records en grootte.
5. Kwaliteit en delivery.
6. Referenties.
7. Traditionele mandagenvergelijking.
8. Open acties met concrete eigenaar of benodigde verbinding.

Gebruik geen fake data en presenteer onzekere of ontbrekende cijfers nooit als feiten.

## Triggerprompt

`Maak een project overview volgens de project-overview-skill. Gebruik actuele repositorycijfers en Supabase-MCP als die verbonden is. Geef absolute referenties, vermeld ontbrekende data expliciet en gebruik geen fake data.`

