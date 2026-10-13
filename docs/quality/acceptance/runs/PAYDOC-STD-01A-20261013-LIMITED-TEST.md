# PAYDOC-STD-01A — beperkte synthetische TEST-release

Datum: 2026-10-13. Status: **LIMITED TEST RELEASE — geen volledige security- of productieacceptatie**
Autorisatie: Edwin heeft in deze taak expliciet ingestemd met de beperkte TEST-release volgens AA-REL §8.

## Scope en provenance

- Featurecode: `c7557a3c6fb72054ef7afcc801792d90caf8e354` (featurecommit `6914e2d0c820e790b7ff0c36c4f2020b0143e651`).
- Gecontroleerde basis bij deze closeout: `origin/main` `63d1221bb066d66b5429dfdd6d1d5172d6b7f7e8`.
- Alleen PAYDOC-STD-01A-code en deze release-evidence vallen binnen scope. PAYLAB-UX-01 blijft buiten scope.
- Geen gebruikers, rollen, rechten, runs of TEST-data aangemaakt of gewijzigd; geen autorisatie omzeild.

## Bestaand bewijs dat wordt hergebruikt

- Finale volledige suite op feature-SHA `c7557a3c6fb72054ef7afcc801792d90caf8e354`: 626 testbestanden geslaagd, 4 overgeslagen; 3.002 tests geslaagd, 8 overgeslagen, 0 mislukt. Deze suite is niet herhaald.
- De bestaande gerichte PDF-, artifact- en autorisatiecontracttests zijn op de geïntegreerde featurecode geslaagd; ze zijn niet opnieuw uitgevoerd.
- Het bestaande historische PDF-artifact is onveranderd: 33.174 bytes, SHA-256 `41a84b88ebd06b01eb49802002a14d20f7170eb58628bd884f6d8c5472f1e82a`.

## Open acceptatiebewijs

Alleen-lezen TEST-inventaris wees de FINALIZED-run `57ac6c10-7a02-49c4-a588-2ca244e621d9` toe aan Jupiter BV onder De Sterren holding → Planeten. De bestaande Test HR Admin heeft als actieve administratie Mars BV en kan Jupiter BV niet selecteren; in de Mars-runlijst staat deze Jupiter-run niet. Daardoor is de bestaande PDF-browserflow met deze gebruiker niet uitvoerbaar.

- **OPEN — PAYDOC-STD-01A-PDF-001:** bestaande Payroll → Salarisrun → LiquidHR Standard Loonstrook bekijken/downloaden-flow en één echte PDF-response (status/content-type) zijn niet bewezen.
- **OPEN — PAYDOC-STD-01A-AMOUNT-002:** live vergelijking van de PDF-bedragen met de FINALIZED-run is niet uitgevoerd.

Heropen deze punten wanneer de bestaande gebruiker de run via reeds toegestane context kan bereiken. Behoud de autorisatie-/administratiescope; maak geen gebruiker, rol, recht, run of TEST-data aan en gebruik geen bypass. Registreer geen persoonlijke bedragen in logs.

## Releasegrens

De twee browser-/bedragspunten zijn expliciet OPEN en niet GREEN. De beperkte synthetische TEST-release is geen volledige ACCEPTANCE GREEN, geen volledige securityacceptatie en geen productieacceptatie. De geautomatiseerde Vercel Git-deployment en hosted safety smoke worden na integratie afzonderlijk gecontroleerd; er wordt geen handmatige deployment gestart.
