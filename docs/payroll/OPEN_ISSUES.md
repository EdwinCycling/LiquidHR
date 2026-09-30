# Payroll Lab open issues

2026-09-30 M0 update: synthetic PAYLAB02 is accepted; see
[evidence](acceptance/PAYLAB02-M0-20260930.md). The historical JWT issue did not
recur during existing HR Admin Test Auth browser acceptance. PAYLAB01 live Core
source proof remains unexecuted rather than newly claimed as accepted.

1. **Authenticated test environment clock validation — PAYLAB00 closed as
   environment-gated.** A fresh local test login redirected successfully, but
   the first authenticated page read failed with PostgREST
   `PGRST303: JWT issued at future`. Resolve Auth/PostgREST time alignment in
   the test environment before attempting a future authenticated source read.
   Do not repeat PAYLAB00 acceptance in this slice.
2. **PAYLAB01 live integration evidence — pending environment recovery.** The
   source adapter has targeted tests, but there is no live authenticated
   Core-to-snapshot/hash result because the test context cannot be read after
   login. No Core data should be created to work around this.
3. **IncomeRelationship — SOURCE_GAP/UNSUPPORTED.** CONTROL02 remains owner of
   the accepted administration/IKV import contract. Do not infer an
   IncomeRelationship from Employment or construct a replacement Core contract.
4. **Tax/fiscal source fields — SOURCE_GAP.** No tax status, withholding choice
   or other fiscal value is mapped until an accepted Core source contract
   reliably provides it.
5. **Atomic orchestration / retention — later hardening.** Synthetic PAYLAB02
   calculation and persistence are accepted. Sequential writes before run
   insertion can leave append-only snapshot/input records after a failure.
   No extra migration or cleanup was performed in this M0 slice.
