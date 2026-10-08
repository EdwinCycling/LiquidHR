# CONTROL02: echte PostgreSQL-writerregressie

De harness start lokale PostgreSQL 17.10 en voert iedere casus transactioneel met rollback uit. Fixtures bevatten uitsluitend synthetische personen, scope, plan, beslissingen en ledger. Iedere run gebruikt een eigen datadirectory; de server stopt na de run. Geen remote write.

Installeer de runtime buiten de repository:

```powershell
npm.cmd install --prefix '<runtime-directory>' --save-exact --no-audit --no-fund embedded-postgres@17.10.0-beta.17 pg@8.23.1
node.exe apps/hr-suite/scripts/control02-postgres-writer.mjs '<runtime-directory>' apps/hr-suite/supabase/migrations/20261008154011_control02_test_final_writer_runtime_guards.sql
```

De engine luistert uitsluitend op 127.0.0.1:55438. De runner geeft een niet-nul exitcode bij een falende casus en schrijft results.json in de runtime-directory.

schema.sql is een schema-only snapshot van 19 relevante TEST-tabellen, gebruikte enums en 123 PK/UNIQUE/CHECK/exclusion-constraints. De echte eventrecorder en nummerallocator worden gebruikt. Foreign keys, RLS, JWT-context en overige Supabase-triggers zijn niet gekloond. De permission-helper is een lokale false-stub; dit is geen remote autorisatiebewijs. Volledige TEST-auth/browseracceptatie blijft een aparte gate.

De tweede-IKV positieve casus gebruikt expliciet twee afzonderlijke Employments. De negatieve casus bewijst dat overlappende IKVs bij hetzelfde Employment worden geweigerd zonder tweede Core-write. Dit verandert de bestaande TEST-batch of bevestigde mapping niet.
