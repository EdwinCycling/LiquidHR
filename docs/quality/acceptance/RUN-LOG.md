# Acceptance Run Log

Detailed screenshots and probes remain in the corresponding `.artifacts` directory and are not copied here.

| Run | Result | Proven scope | Open boundary |
|---|---|---|---|
| A01 | GREEN | Full DEV persona acceptance for Focus, Absence and Leave | Regression maintenance |
| GJ01 | PARTIAL / EXTERNAL_BLOCKER | HR journey, preview, responsive checks; `databaseUuid` fix | Authenticated future Employee leg; DEV Auth mail delivery returned 502 |
| GJ02 | GREEN | Batch → item → snapshot → dossier → signing → SIGNED; document access and negative role checks | DOC02 rendering |
| GJ03 | GREEN | Employee Actual Work create/edit through canonical service/RPC/RLS; validation, privacy and projections | AW02 rules/concurrency |

Historical commit anchors: GJ01 `a4e0af5`; GJ02 `4d0bfdd`; GJ03 `65f8abe`; overnight handoff `d792a7c`.

GJ01 used Test test100 with start date 2026-10-01. The normal invitation endpoint returned HTTP 502 twice; invitations were revoked. One controlled DEV Auth identity was established through fixture-auth bootstrap; one identity, two revoked invitations and zero employee Auth links were read back. Normal login ended at `/geen-toegang`, so authenticated preboarding Focus and start-date transition were not proven. Preview responsive checks were green.

GJ02 proved one completed batch, final item, final PDF snapshot with storage/hash, employee dossier link and signing request with PREPARED and SIGNED events. Focus Documents viewer/download was corrected to use the secure canonical service query. Employee own actions passed; generation, HR direct signing and Manager/out-of-scope paths failed closed.

GJ03 added `self:actual-work:write`, own-row RLS insert/update/read and HR-only delete while retaining the security-invoker RPC. One Employee row was created at 1.75 hours and corrected to 2.0; revisions and totals read back. Foreign reads/writes, Manager misuse, closed periods, future dates, inactive types and approved Leave overlap failed closed without ledger mutation.
