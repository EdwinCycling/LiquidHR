# R4 Recruitment Vacancies List — branch handoff

Datum: 2026-08-24
Branch: `work/r4-recruitment-vacancies`
Baseline: `1471aa224e2318b0c216d95e16b2ba1c4cd3ec64`
Scope: `/recruitment/vacancies`, `RecruitmentVacancyList`, vacancy list/filter service en directe tests.

## Scope en implementatie

De baseline had geen eigen `/recruitment/vacancies`-list; de bestaande `/recruitment`-overview bleef buiten scope. De nieuwe list-route gebruikt de bestaande Recruitment-service, tenant/HR-group-scope en permissioncontracten. De workspace levert:

- URL-state voor zoeken, vacaturestatus, publicatiestatus, sortering en pagina;
- zoeken op functietitel/locatie, status/publicatiefilters, drie bestaande relevante sorteringen en paginering van 10 resultaten;
- expliciete status- en publicatiebadges voor `DRAFT`, `ACTIVE`, `CLOSED`, `ARCHIVED`, `OPEN`, `CLOSED`, `ARCHIVED` en niet gepubliceerd;
- Foundation `PageShell`, `PageHeader`, `FilterBar`, `Surface`, `Badge`, `EmptyState`, `TextInput`, `DropdownSelect` en `Button`-contracts;
- detail-drilldown voor iedere vacature en bestaande edit/create-links uitsluitend wanneer `recruitment-vacancy:write` aanwezig is;
- NL/EN feature-keys met gelijke keyset.

RecruitmentVacancyDetail, Pipeline en de bestaande vacancy create/edit-form zijn niet gewijzigd. Er is geen nieuwe create-flow uitgevonden; de mutation lifecycle voor deze read/list-slice is `N/A`.

## Permissions en testdata

De route vereist Recruitment-moduletoegang plus `recruitment-vacancy:read` of `recruitment-candidate:read`. Write actions worden uitsluitend gepresenteerd bij `recruitment-vacancy:write`; server-side bestaande guards blijven leidend.

Testdata-prefix: `R4-REC-LIST`. Er is geen eigen record aangemaakt, dus er is geen create/readback/cleanup-lifecycle en zijn er geen residual IDs. Bestaande synthetische `TEST-RECRUITMENT-*` vacatures zijn alleen gelezen en er is geen externe publicatie uitgevoerd.

## Acceptance evidence

- HR Admin: authenticated Planeten/HR-fixture op de route; 3 bestaande vacature-rows, status/publication badges, detaillinks en write-visible create/edit acties zichtbaar.
- Search: `TEST-RECRUITMENT-Product Designer` gaf 1 resultaat.
- Status filter: `Concept` filter gaf 0 resultaten in combinatie met de Product Designer search en de no-results state werd zichtbaar.
- URL-state/reload: filter-URL bleef na reload behouden (`q`, `status`, `publication`, `sort`).
- Desktop: authenticated route gerenderd via Webpack dev op 3142; route GET 200.
- 390×844: authenticated route gerenderd; compacte header/filter/list composition gecontroleerd; geen horizontale overflow waargenomen.
- Browserconsole: 0 errors / 0 warnings op de gecontroleerde listflow; resterende devtools/HMR-info is geen producterror.
- Manager/Employee: runtime negative browserflow niet opnieuw uitgevoerd nadat de eerste authenticated browsercontext was gesloten. Een veilige retry zonder password-echo werd door de tooling niet ondersteund; er is geen negatieve runtimeclaim gemaakt. De route- en write-permissionguards zijn statisch gecontroleerd.

Exacte relevante statuses: authenticated list GET `200`; authenticated filtered GET `200`; authenticated reload GET `200`; unauthenticated navigation landde op `/login?next=/recruitment/vacancies` met login-render `200`; mutation status `N/A`.

## Gates

- Targeted vacancy service: `1` testbestand / `6` tests groen.
- Volledige hr-suite: `234` testbestanden / `902` tests groen.
- Strict TypeScript: groen.
- i18n: `33` namespaces, gelijke NL/EN-sleutels, groen.
- ESLint: `0` errors / `8` bestaande warnings; geen nieuwe warning in de gewijzigde listbestanden.
- `git diff --check`: groen.
- Production build: niet uitgevoerd; de parallel-slicecontracttekst reserveert één centrale Webpack-build voor integratie. De owned route is via Webpack dev compile/render bewezen.
- Migration/RLS: `NONE`; geen schemawijziging, remote migration, Supabase-write, push, merge, deploy of version bump.

## Changed files en integratie

Gewijzigd:

- `apps/hr-suite/app/(dashboard)/recruitment/vacancies/page.tsx`
- `apps/hr-suite/components/recruitment/recruitment-vacancy-list.tsx`
- `apps/hr-suite/lib/recruitment/vacancy-service.ts`
- `apps/hr-suite/lib/recruitment/vacancy-service.test.ts`
- `apps/hr-suite/messages/nl/recruitment.json`
- `apps/hr-suite/messages/en/recruitment.json`
- dit branch-handoffdocument.

Foundation-, navigation-, Detail-, Pipeline-, API-, schema-, migration- en centrale delivery/statusbestanden zijn niet gewijzigd. De branch is lokaal gecommit; integratie moet de centrale Webpack-build en Manager/Employee negative acceptance opnieuw uitvoeren.
