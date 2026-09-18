# ESS/MSS Workflow Unification V1

**Status:** kandidaat op `work/ess-mss-workflow-unification-v1`, gebaseerd op exact `origin/main` `6f9f61b85d2b488557d066fcabdbb39e60f2b39b`.

## Doel en scope

ESS en MSS gebruiken één werkmodel voor procesgestuurde aanvragen en acties. De bestaande Process Automation-kernel blijft de bron voor procesdefinities, versies, instances, stappen, work items, deelnemers, transitions, idempotency en audit. De workbench `/work` biedt een uniforme projectie met `WORK` en `REQUESTS` als views, server-side status-, business-type-, business-category-, administratie- en subjectfilters en behoud van URL-state.

De verticale V1-slice maakt Leave self-service beschikbaar via `/leave/request`. De aanvraag wordt eerst als `PENDING` in de bestaande Leave-domeintabel opgeslagen, daarna via de bestaande `start_process`-kernel gestart. De typed bridge `process_leave_subjects` koppelt de Leave-aanvraag aan de process instance zonder directe Data API-toegang. De manager handelt via de native Leave-detailroute; uitsluitend de effectieve `APPROVE`-actie kan binnen dezelfde transactionele adapter de bestaande Leave-booking en append-only `TAKEN`-ledger uitvoeren.

## Reconciliatie van bestaande domeinen

- P-mutaties behouden de bestaande dynamic renderer, form bindings, native Internal Transfer-preview/commit en generieke work-item-acties. De nieuwe projectie en routing veranderen hun eigenaarschap of autorisatie niet.
- Leave krijgt een native aanvraag- en detailervaring omdat de Leave-formule, entitlementcontrole, FIFO-allocation, jaarlocks en ledger al bij Leave horen. De legacy HR-kalenderroute blijft ongewijzigd.
- Actual Work krijgt alleen een native workflow-landingsroute en uniforme metadata/filtering. De canonieke Actual Work-ledger en `save_actual_work_entry` blijven de enige bron; V1 maakt geen tweede booking- of approval-ledger.
- De seeded `leave-request` recipe is typed en compiler-compatibel. De expliciete `REQUEST_CHANGES` recovery-lus onderscheidt een nieuwe employee `ACKNOWLEDGE` van terugkeer naar een eerder managerbesluit.

## Lifecycle

1. Een medewerker start een self-service aanvraag met `self:leave:request`; server-side employment-, profiel-, rooster-, feestdag- en entitlementcontroles bepalen de minuten en Leave-typen.
2. De aanvraag en process instance worden atomair aangemaakt. De eerste employee work item wordt met `ACKNOWLEDGE` ingediend; de medewerker ziet `WAITING` en de manager ziet `OPEN` of `IN_PROGRESS`.
3. De manager kan `APPROVE`, `REJECT` of `REQUEST_CHANGES`. `APPROVE` roept alleen de Leave booking adapter aan; `REJECT` eindigt zonder booking; `REQUEST_CHANGES` zet de aanvraag op `CHANGES_REQUESTED`.
4. Na wijziging dient de medewerker opnieuw in via de expliciete retrystap. Herhaalde wijzigingsrondes lopen alleen via de expliciete recovery-transitie en behouden optimistic versions, idempotency en actorchecks.
5. `CANCEL` is alleen beschikbaar binnen de toegestane open self-service-state en boekt nooit uren.

## Security en consistentie

Alle exposed tabellen hebben RLS. De bridge is fail-closed voor directe authenticated/anon tabeltoegang. De publieke wrappers voor starten en handelen zijn authenticated-only security-invoker wrappers rond private security-definer helpers met server-side tenant, HR-groep, administratie, medewerker, permission, actor en process-form checks. Database-locks, expected versions, idempotency keys en de bestaande process event/domain-commit-tabellen beschermen tegen dubbele of concurrerende acties.

## Deliverygrenzen

DEV/TEST Supabase `wnpfloqpjvaacobppbpk` is de enige remote omgeving voor deze slice. De enum-, hoofd-, advisor-index- en wrapper-execution-migrations zijn daar toegepast en read-back gecontroleerd; advisors geven geen nieuwe FK-indexwaarschuwing meer. Supabase Production, Vercel, GitHub push, merge en cleanup zijn geen onderdeel van deze gate.

De lokale gate is uitgevoerd op de geïsoleerde worktree. De gerichte workflow-suite is groen met `39/39` tests; strict TypeScript, ESLint, i18n-pariteit, `git diff --check` en de productiebuild zijn groen. De volledige suite rapporteert `1564/1565` tests groen; alleen de bestaande 5-seconden timeout in `lib/document-generation/pdf.test.ts` blijft als baselinefailure open. Authenticated browseracceptatie bevestigde de employee/manager actorgrenzen, maar de positieve manager-booking werd door de bestaande Leave-ledger geweigerd met `LEAVE_INSUFFICIENT_BALANCE`; persisted readback bleef `PENDING` zonder domain commit, allocation of `TAKEN`-transactie. Een positieve end-to-end booking-readback en request-changes recovery vereisen expliciete toestemming voor één bounded DEV-opening balance via de bestaande HR-ledgerflow.
