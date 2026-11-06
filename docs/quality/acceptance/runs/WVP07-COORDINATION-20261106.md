# WVP07 — HR-verzuimregie

**06-11-2026 — lokaal gebouwd; acceptatie OPEN.** Het bestaande WVP-casusoverzicht toont toegankelijke dossiers, aantallen lopende dossiers en open verlopen/binnenkort vervallende mijlpalen, prioriteiten op deadline, directe dossierlinks en filters voor urgentie en status. Ontbrekende taakgegevens en de bestaande lijstgrens van 250 worden gemeld. De tellingen beschrijven uitsluitend de teruggegeven casussen en claimen geen wettelijke compleetheid.

Het overzicht vereist server-side `absence:read` vóór de bestaande `wvp_list`; de bestaande tenant-, HR-groep-, administratie- en teamscope blijft leidend. Er zijn geen nieuwe databasecontracten, medische velden of mutaties. Gerichte regressies voor weigering en deadlinevolgorde zijn toegevoegd. De WVP-INT01 security-HOLD en afzonderlijke migratiemandaten blijven OPEN.

NL/EN i18n (43 namespaces) en `git diff --check` zijn PASS. Vitest/PGlite, TypeScript en lint zijn NOT RUN: de lokale binaries ontbreken. Browser-/personaacceptatie is NOT RUN: poort 3000 luistert niet en de lokale Next-binary ontbreekt. Geen push, main-merge, migratie of release in deze cyclus.
