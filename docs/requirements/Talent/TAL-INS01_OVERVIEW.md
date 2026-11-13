# TAL-INS01 — Talent & Development-overzicht

> **13-11-2026 — aanvullende acceptatie PARTIAL:** HR Admin en Manager openden het ontwikkelrapport; Employee werd eerder geweigerd. Volledige bronherleiding, filters en negatieve scopegevallen blijven OPEN. Zie [handoff](../../delivery/LIQUIDHR-INTEGRATION-HANDOFF-20261113.md).

> **13-11-2026 — integratieacceptatie PARTIAL:** het bestaande ontwikkelrapport is lokaal geopend als HR Admin en Manager; Employee werd uit het managementrapport geweigerd. De volledige bron-, filter- en scopeset blijft OPEN. Zie [integratiehandoff](../../delivery/LIQUIDHR-INTEGRATION-HANDOFF-20261113.md).

**06-11-2026 — lokale kandidaat.** Het bestaande ontwikkelrapport toont samen de bestaande ontwikkelplan-, skills-/competentie- en gespreksbronnen. Actieve plannen en hun vastgelegde gemiddelde voortgang verwijzen naar de bestaande ontwikkelplanroute; skillvereisten zonder beoordeling en met verlopen bewijs verwijzen naar het bestaande skillgaprapport; ontbrekende gesprekregistraties en verlopen opvolging verwijzen naar het bestaande gespreksrapport. Bestaande medewerker- en planlinks blijven in de detailrapporten beschikbaar.

De bestaande `getStarPerformersInsights`-berekening en `resolveStarPerformersReadAccess` bepalen de HR Admin- en directe Manager-scope en passen de rapportfilters toe. Employee krijgt geen managementrapportage; ESS blijft ongewijzigd. Afzonderlijk onbeschikbare bronnen worden als zodanig weergegeven. Niet beoordeeld en verlopen bewijs zijn geen negatieve scores. Er is geen gevalideerde ouderdomsgrens voor een verouderde beoordeling; het overzicht signaleert daarom alleen daadwerkelijk verlopen bewijs en opvolging. Er worden geen nieuwe scores, AI-beoordelingen, databaseobjecten of rechten ingevoerd.

NL/EN i18n en `git diff --check`: PASS. Gerichte Vitest-/autorisatieregressie, TypeScript, lint en browser/personaacceptatie: NOT RUN omdat de bestaande binaries/runtime ontbreken. De nieuwe gecombineerde Manager-scopetest is opgenomen maar niet uitgevoerd. Live HR Admin-, Manager-, Employee- en negatieve scopeacceptatie blijft OPEN.
