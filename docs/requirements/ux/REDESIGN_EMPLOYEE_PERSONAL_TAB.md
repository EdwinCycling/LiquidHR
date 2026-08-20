# Employee Personal Tab — UX Foundation v1

Status: **GEIMPLEMENTEERD — BROWSERGATE OPEN**  
Route: `/employees/[employeeId]?tab=personal`  
Scope: Persoonsgegevens, Adressen, Bankrekeningen, Relaties en Aanvullende informatie.

## Doel

De volledige personal-tab gebruikt dezelfde rustige Foundation v1-taal als Employee Detail en LinkedHR, zonder functionele wijzigingen aan data, API-routes, mutations, permissions, RLS, validatie, audit of i18n-contracten.

## Ontwerp

- De personal-tab gebruikt een vlakke `Surface` met subtabs als transparante tablist met een 2px actieve onderrand.
- Persoonsgegevens gebruikt `SectionHeader`, `InfoList`, `Badge`, Foundation-controls en section separators in plaats van card-in-card.
- Adressen behouden zoeken, lookup, handmatige invoer, adresgeschiedenis, verhuisflow, geldigheidsdata en reminders; records zijn compacte disclosures met maximaal één record-surface.
- Bankrekeningen en relaties zijn scanbare bordered lists met Foundation `Badge`-statussen en capability-driven acties.
- Custom fields blijven dezelfde API en form action gebruiken; embedded presentation gebruikt Foundation-styling.

## Responsive en toegankelijkheid

- Subtabs scrollen horizontaal op smalle schermen; formulieren vallen terug naar één kolom.
- `role=tablist`, `role=tab`, `aria-selected`, `aria-controls`, ArrowLeft/ArrowRight en Home/End blijven behouden.
- Labels, focus-visible, disabled/loading states en disclosure state blijven zichtbaar en bruikbaar.
- Controlepunten zijn desktop en 390px, in LiquidHR en LinkedHR.

## Acceptatiecriteria

- Alle vijf subtabs openen zonder functionele regressie.
- Personal edit/save/cancel en protected BSN reveal/audit blijven intact.
- Address search/lookup/manual entry, primary/secondary, relocation, reminders en delete restrictions blijven intact.
- Bank primary/masked IBAN, relation emergency contact en custom fields blijven intact.
- Geen schema-, migration-, API-, permission-, RLS-, security-, theme-token-, release- of deploymentwijziging.
- Gerichte componentcontracttest, strict TypeScript, lint, i18n-check, volledige testsuite, build, diff-check en browsermatrix zijn uitgevoerd of expliciet als open/blocker gerapporteerd.
