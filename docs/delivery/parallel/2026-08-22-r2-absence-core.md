# Roadmap 2 — Absence Core handoff

Datum: 2026-08-22

Branch: `work/r2-absence-core`

Worktree: `.codex-worktrees/r2-absence-core`

Baseline: `abfa0bbb7db628f588faa3d4818a4f4663f27b46`
Finale lokale commit: zie `git HEAD` bij overdracht; deze handoff wordt samen met de lokale commit vastgelegd.

## Scope

De primaire Absence UX is naar de bestaande UX Foundation v1.2 gebracht. De scope bleef beperkt tot de absence-create flow, de absence-weergave in Employee Detail en de bestaande Employee-dashboardweergave. Routes, API-contracten, database, RLS, permissions en data-eigenaarschap zijn niet gewijzigd.

## Implementatie

- De nieuwe absence-pagina gebruikt `PageShell`, `PageHeader`, `Surface`, `SectionHeader`, `FormField` en `Button`.
- De absence-caselijst is een domeinspecifieke compositie op `EntityList` en `Badge`, met klikbare primaire datum, status, periode en percentage.
- Employee Detail gebruikt `DetailColumns` voor de actieve case en een functioneel action-aside.
- Recovery- en capacity-acties worden server-side capability-aware aan de UI doorgegeven en voor employee self-service verborgen.
- Employee self-service kan een smalle sickness-report payload zonder percentage versturen; de bestaande RPC-default van 100% blijft behouden.
- Mutaties verversen de bestaande routecontext met `router.refresh()`.

## Gewijzigde bestanden

- `apps/hr-suite/app/(dashboard)/absence/new/page.tsx`
- `apps/hr-suite/app/(dashboard)/employees/[employeeId]/page.tsx` — gedeeld-bestand-exceptie voor server-side capability wiring en de absence-lijst.
- `apps/hr-suite/components/absence/absence-case-detail.tsx`
- `apps/hr-suite/components/absence/absence-case-list.tsx`
- `apps/hr-suite/components/absence/absence-quick-form.tsx`
- `apps/hr-suite/components/employees/employee-dashboard.tsx`
- `apps/hr-suite/lib/absence/schemas.test.ts`
- `apps/hr-suite/lib/absence/schemas.ts`
- `apps/hr-suite/lib/absence/service.ts`
- `docs/delivery/parallel/2026-08-22-r2-absence-core.md`

De centrale Foundation-mappen en alle uitgesloten delivery-/requirementsbestanden zijn niet gewijzigd.

## Technische verificatie

- Gerichte absence-/insights-tests: GREEN — 10 testbestanden, 29 tests.
- Strict TypeScript: GREEN — `npm.cmd run type-check --workspace @liquid-hr/hr-suite`.
- i18n: GREEN — 33 namespaces met gelijke NL/EN-sleutels.
- Gerichte ESLint op alle gewijzigde TypeScript/TSX-bestanden: GREEN.
- `git diff --check`: GREEN.
- Volledige suite en productiebuild: niet uitgevoerd; buiten de vereiste scoped gate omdat geen schema, RLS, auth, routing of gedeelde infrastructuur is gewijzigd.

## Browser- en persona-acceptatie

Preflight en runtime zijn geprobeerd op exact deze worktree en poort 3101. Zowel de worktree als de broncheckout missen `apps/hr-suite/.env.local`. Daardoor ontbreken `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

- `/login`: HTTP 500 — Supabase-client kan zonder URL/key niet worden aangemaakt.
- `/dashboard/start`: HTTP 500 — dezelfde environment blocker.
- `/absence/new`: HTTP 500 — dezelfde environment blocker.
- Canonieke fixture-auth: niet uitvoerbaar; `fixtures:talent-auth` eindigde met code 9 wegens ontbrekende `.env.local`.
- HR `hradmin.fixture@liquidhr.test`: niet geauthenticeerd / niet getest.
- Manager `manager.fixture@liquidhr.test`: niet geauthenticeerd / niet getest.
- Employee `employee.fixture@liquidhr.test`: niet geauthenticeerd / niet getest.
- Report-create, recovery, capacity, readback en negatieve authorization-statussen: niet uitgevoerd; geen geldige Supabase-runtime.
- Desktop- en 390x844-acceptatie: niet uitgevoerd; geen geldige route-render/auth-sessie.
- Tijdelijke testrecords: geen records aangemaakt, dus geen cleanup nodig.

Dit is een omgevingsblokkade, geen bewezen in-scope product-RED. Na beschikbaar maken van de projectconfiguratie moeten de drie verse persona-sessies, echte HTTP-statussen/readbacks en desktop/390x844 opnieuw worden uitgevoerd.

## FOUNDATION_GAP / RED / BLOCKED

- `FOUNDATION_GAP`: geen. Bestaande Foundation v1.2-componenten zijn hergebruikt; er is geen lokale generieke kopie toegevoegd.
- Product-RED: geen bewezen in-scope RED.
- `BLOCKED`: authenticated browser/API acceptance is geblokkeerd door ontbrekende lokale Supabase-configuratie.

Geen remote writes, push, merge of deploy uitgevoerd.
