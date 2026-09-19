# Focus acceptance evidence — 2026-09-19

## Verdict

**NOT RELEASE-GREEN**

The acceptance run stopped at the required DEV migration-history gate. No persona mutation or browser acceptance was started after that stop, so no false PASS evidence was recorded.

- Existing branch: `work/focus-completion-act-as-20260918`
- Candidate commit: `cf6cffcc88e59fc19bb7d5d35be0c8a64601cc80`
- Remote branch: `origin/work/focus-completion-act-as-20260918`
- DEV project: `wnpfloqpjvaacobppbpk`
- Production: untouched; no deployment performed
- Screenshot files: none for this run; runtime acceptance was blocked before a safe DEV state existed

## Gate evidence

Supabase platform authentication was available for this run. The read-only commands reached DEV successfully:

- `supabase migration list --project-ref wnpfloqpjvaacobppbpk`
- `supabase db push --dry-run --project-ref wnpfloqpjvaacobppbpk`

The dry-run stopped with `LegacyDbPushMissingLocalError`.

| Comparison | Count |
| --- | ---: |
| Remote numeric migration versions | 479 |
| Local numeric migration versions | 431 |
| Shared versions | 107 |
| Remote-only, missing locally | 372 |
| Local-only, absent from DEV history | 324 |

No `supabase migration repair`, `supabase db pull`, `supabase db push`, reset, placeholder migration, or history rewrite was performed. The remote-only versions cannot be safely reconciled by inference: all 372 exact remote-only version paths were absent from reachable Git history. Therefore the instruction's safe-stop condition applies.

### Remote-only versions by month

| Month | Count |
| --- | ---: |
| 202607 | 81 |
| 202608 | 234 |
| 202609 | 57 |

### Exact remote/local discrepancy table — remote-only

| Version | Direction | Historical recovery |
| --- | --- | --- |
| 20260715064739 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715065045 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715070507 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715071143 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715071358 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715071628 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715071903 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715072107 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715073155 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715121230 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715121320 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715122918 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715123259 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715123813 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715124108 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715124556 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715124804 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715130038 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715131340 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715145258 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715145518 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260715174156 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260716105509 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260716105512 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260716105514 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260716105530 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260717063601 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260717063738 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260717070234 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718072501 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718073529 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718073708 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718074511 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718074915 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718075533 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718075707 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718080153 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718080451 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718081434 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718122018 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718122221 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718122649 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718122811 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718123821 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718124259 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718133738 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718140551 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718144212 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718144239 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718144648 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718144805 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718172527 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260718180418 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260719141109 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260719141117 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260719141125 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260719151802 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260719160032 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260719160107 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260722172039 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260722172724 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260722180907 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260722181911 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260722183251 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260722183609 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260722183622 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260722184757 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260723131241 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260724105304 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260724105322 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260724110804 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260724112526 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260724172444 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260724172739 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260725165528 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260726103257 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260726103607 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260726103706 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260726103820 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260728180039 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260731172748 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260801100133 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802061126 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802061857 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802063946 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802074722 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802074823 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802090653 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802095702 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802104821 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802121434 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802131815 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802135043 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802135147 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802135512 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802135629 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802143724 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802151416 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802160935 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802162412 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802164131 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802164947 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802165314 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802172255 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802172601 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802172652 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802175338 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802175400 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802175914 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802180454 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802181304 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802182036 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802182705 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802183250 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260802183735 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260803063312 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260803064837 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260803065217 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260803081118 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260803082559 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260803131226 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260803131327 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260803131651 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260803131755 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260803154348 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260803154946 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260803160142 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804142222 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804142227 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804143032 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804143037 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804143043 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804143049 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804143059 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804143855 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804143924 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804144733 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804144852 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804145603 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804150253 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804150350 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804150432 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804152239 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804153139 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804171533 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260804171733 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805163905 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805163911 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805163920 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805164138 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805164400 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805170754 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805171235 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805171346 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805172434 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805181522 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805183133 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805184206 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805184827 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805194836 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805194944 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805195117 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805200142 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805202652 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805202743 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805202830 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805203149 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260805204012 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260806055307 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260806130420 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260806133414 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260806133633 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260806143509 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260806174202 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260806174221 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260806174857 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260807101032 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260807101055 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260807103403 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260807104230 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260807130439 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260807134827 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260807141249 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260807142447 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260807143032 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260807150343 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260807185718 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260807185727 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260807185745 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808122825 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808124007 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808125031 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808125355 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808130433 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808130754 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808133244 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808142120 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808142249 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808143934 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808150421 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808150518 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808150735 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808151005 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808151757 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808152322 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808152958 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808153202 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808153304 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808153411 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808155112 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808160102 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808165508 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808170647 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808170859 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808171012 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808171249 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808171520 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808172015 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808172520 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808172954 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808174957 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808175317 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808180712 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260808181834 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260809064542 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260809065842 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260809110930 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260809113109 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260809113434 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260809173918 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260809174125 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260809174138 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260809174153 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260809174814 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260809183215 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260809184450 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260809185143 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260809185541 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260809202553 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260809205124 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260809205225 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260809210156 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260810045343 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260810045650 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260810071646 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260810073639 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260810073759 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260810083029 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260810083239 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260810092510 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260810110632 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260810110641 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260810110647 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260810171708 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260810172010 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260810173837 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260810174340 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260810175704 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260811155252 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260811155521 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260811161353 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260811162657 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260811162737 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260811174737 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260812134246 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260812134832 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260812144111 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260812150930 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260812151101 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260813105157 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260813105231 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260813105820 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260813110057 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260813113208 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260813122237 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260813142035 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260813142057 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260813144216 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260814071705 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260814071914 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260814072059 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260814072452 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260814073049 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260814073225 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260814074453 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260814074539 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260814075455 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260814135719 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260814135733 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260814135838 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260814140439 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260814181059 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260814203019 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260815072029 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260816082211 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260816082704 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260816083953 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260816085722 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260816090726 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260816093501 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260816151833 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260821144840 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260823093210 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260823093330 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260823172732 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260825150000 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260828080428 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260828124612 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260828133631 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260828142233 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260828142639 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260829134822 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260831071555 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260831093310 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260831165143 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260902133926 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260902134553 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260903083922 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260903084150 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260903114306 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260903125537 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260904093131 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260904115635 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260904122149 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260904123535 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260904144331 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260904145116 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260904163251 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260904172754 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260907085714 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260907151519 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260908181859 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260908184235 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260908203016 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260909125131 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260909133103 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911133359 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911134443 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911135330 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911153510 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911175233 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911175631 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911180807 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911181912 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911182309 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911182427 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911183016 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911183749 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911184055 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911184201 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911185252 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911185751 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911190001 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911190603 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911192201 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911193943 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260911194336 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260912072902 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260912074511 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260912123318 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260912150853 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260912184117 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260912193619 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260912203744 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260913092334 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260913123613 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260914142023 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260914154120 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260914154659 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260915122914 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260915163650 | remote-only; missing locally | exact historical body not reachable in Git |
| 20260915182841 | remote-only; missing locally | exact historical body not reachable in Git |

### Exact remote/local discrepancy table — local-only

| Version | Direction | DEV comparison |
| --- | --- | --- |
| 20260715064245 | local-only | no matching DEV history row |
| 20260715064924 | local-only | no matching DEV history row |
| 20260715070404 | local-only | no matching DEV history row |
| 20260715071054 | local-only | no matching DEV history row |
| 20260715071156 | local-only | no matching DEV history row |
| 20260715071422 | local-only | no matching DEV history row |
| 20260715071717 | local-only | no matching DEV history row |
| 20260715072010 | local-only | no matching DEV history row |
| 20260715072908 | local-only | no matching DEV history row |
| 20260715120810 | local-only | no matching DEV history row |
| 20260715121304 | local-only | no matching DEV history row |
| 20260715122802 | local-only | no matching DEV history row |
| 20260715123119 | local-only | no matching DEV history row |
| 20260715123639 | local-only | no matching DEV history row |
| 20260715123927 | local-only | no matching DEV history row |
| 20260715124506 | local-only | no matching DEV history row |
| 20260715124744 | local-only | no matching DEV history row |
| 20260715130026 | local-only | no matching DEV history row |
| 20260715131230 | local-only | no matching DEV history row |
| 20260715141843 | local-only | no matching DEV history row |
| 20260715145432 | local-only | no matching DEV history row |
| 20260715173629 | local-only | no matching DEV history row |
| 20260716092637 | local-only | no matching DEV history row |
| 20260716100000 | local-only | no matching DEV history row |
| 20260716110000 | local-only | no matching DEV history row |
| 20260716120000 | local-only | no matching DEV history row |
| 20260717100000 | local-only | no matching DEV history row |
| 20260717100500 | local-only | no matching DEV history row |
| 20260717101000 | local-only | no matching DEV history row |
| 20260718090000 | local-only | no matching DEV history row |
| 20260718100000 | local-only | no matching DEV history row |
| 20260718100500 | local-only | no matching DEV history row |
| 20260718100600 | local-only | no matching DEV history row |
| 20260718110000 | local-only | no matching DEV history row |
| 20260718110100 | local-only | no matching DEV history row |
| 20260718120000 | local-only | no matching DEV history row |
| 20260718121308 | local-only | no matching DEV history row |
| 20260718122138 | local-only | no matching DEV history row |
| 20260718122614 | local-only | no matching DEV history row |
| 20260718122751 | local-only | no matching DEV history row |
| 20260718123742 | local-only | no matching DEV history row |
| 20260718124240 | local-only | no matching DEV history row |
| 20260718130000 | local-only | no matching DEV history row |
| 20260718131000 | local-only | no matching DEV history row |
| 20260718132000 | local-only | no matching DEV history row |
| 20260718150000 | local-only | no matching DEV history row |
| 20260718170000 | local-only | no matching DEV history row |
| 20260718171000 | local-only | no matching DEV history row |
| 20260718172000 | local-only | no matching DEV history row |
| 20260718172051 | local-only | no matching DEV history row |
| 20260718173000 | local-only | no matching DEV history row |
| 20260718180354 | local-only | no matching DEV history row |
| 20260719101500 | local-only | no matching DEV history row |
| 20260719112000 | local-only | no matching DEV history row |
| 20260719153000 | local-only | no matching DEV history row |
| 20260719170000 | local-only | no matching DEV history row |
| 20260719180000 | local-only | no matching DEV history row |
| 20260719181000 | local-only | no matching DEV history row |
| 20260722173000 | local-only | no matching DEV history row |
| 20260722173100 | local-only | no matching DEV history row |
| 20260722190000 | local-only | no matching DEV history row |
| 20260722190500 | local-only | no matching DEV history row |
| 20260722191500 | local-only | no matching DEV history row |
| 20260722192000 | local-only | no matching DEV history row |
| 20260722192100 | local-only | no matching DEV history row |
| 20260722192500 | local-only | no matching DEV history row |
| 20260723151000 | local-only | no matching DEV history row |
| 20260724095433 | local-only | no matching DEV history row |
| 20260724100605 | local-only | no matching DEV history row |
| 20260724103939 | local-only | no matching DEV history row |
| 20260724112407 | local-only | no matching DEV history row |
| 20260724160000 | local-only | no matching DEV history row |
| 20260724172716 | local-only | no matching DEV history row |
| 20260725132351 | local-only | no matching DEV history row |
| 20260726110000 | local-only | no matching DEV history row |
| 20260726112000 | local-only | no matching DEV history row |
| 20260726113000 | local-only | no matching DEV history row |
| 20260726114000 | local-only | no matching DEV history row |
| 20260728110000 | local-only | no matching DEV history row |
| 20260731193000 | local-only | no matching DEV history row |
| 20260801130000 | local-only | no matching DEV history row |
| 20260802052246 | local-only | no matching DEV history row |
| 20260802061252 | local-only | no matching DEV history row |
| 20260802062335 | local-only | no matching DEV history row |
| 20260802064600 | local-only | no matching DEV history row |
| 20260802070000 | local-only | no matching DEV history row |
| 20260802110000 | local-only | no matching DEV history row |
| 20260802123000 | local-only | no matching DEV history row |
| 20260802150000 | local-only | no matching DEV history row |
| 20260802160000 | local-only | no matching DEV history row |
| 20260802173000 | local-only | no matching DEV history row |
| 20260802190000 | local-only | no matching DEV history row |
| 20260802190500 | local-only | no matching DEV history row |
| 20260802191000 | local-only | no matching DEV history row |
| 20260802191500 | local-only | no matching DEV history row |
| 20260802200000 | local-only | no matching DEV history row |
| 20260802210000 | local-only | no matching DEV history row |
| 20260802210500 | local-only | no matching DEV history row |
| 20260802220000 | local-only | no matching DEV history row |
| 20260802223000 | local-only | no matching DEV history row |
| 20260802224000 | local-only | no matching DEV history row |
| 20260802225000 | local-only | no matching DEV history row |
| 20260802230000 | local-only | no matching DEV history row |
| 20260802231000 | local-only | no matching DEV history row |
| 20260802232000 | local-only | no matching DEV history row |
| 20260802233000 | local-only | no matching DEV history row |
| 20260802233500 | local-only | no matching DEV history row |
| 20260802234000 | local-only | no matching DEV history row |
| 20260802234500 | local-only | no matching DEV history row |
| 20260802235000 | local-only | no matching DEV history row |
| 20260802235500 | local-only | no matching DEV history row |
| 20260802240000 | local-only | no matching DEV history row |
| 20260802240500 | local-only | no matching DEV history row |
| 20260802242000 | local-only | no matching DEV history row |
| 20260803090000 | local-only | no matching DEV history row |
| 20260803091000 | local-only | no matching DEV history row |
| 20260803092000 | local-only | no matching DEV history row |
| 20260803100000 | local-only | no matching DEV history row |
| 20260803102000 | local-only | no matching DEV history row |
| 20260803120000 | local-only | no matching DEV history row |
| 20260803121000 | local-only | no matching DEV history row |
| 20260803122000 | local-only | no matching DEV history row |
| 20260803123000 | local-only | no matching DEV history row |
| 20260803133000 | local-only | no matching DEV history row |
| 20260803140000 | local-only | no matching DEV history row |
| 20260803142000 | local-only | no matching DEV history row |
| 20260803200000 | local-only | no matching DEV history row |
| 20260804100000 | local-only | no matching DEV history row |
| 20260804150000 | local-only | no matching DEV history row |
| 20260804153000 | local-only | no matching DEV history row |
| 20260804154500 | local-only | no matching DEV history row |
| 20260804170000 | local-only | no matching DEV history row |
| 20260804171416 | local-only | no matching DEV history row |
| 20260804171652 | local-only | no matching DEV history row |
| 20260804180000 | local-only | no matching DEV history row |
| 20260804180500 | local-only | no matching DEV history row |
| 20260804183000 | local-only | no matching DEV history row |
| 20260804190000 | local-only | no matching DEV history row |
| 20260805144951 | local-only | no matching DEV history row |
| 20260805144952 | local-only | no matching DEV history row |
| 20260805162000 | local-only | no matching DEV history row |
| 20260805180000 | local-only | no matching DEV history row |
| 20260805182000 | local-only | no matching DEV history row |
| 20260805183000 | local-only | no matching DEV history row |
| 20260805184000 | local-only | no matching DEV history row |
| 20260805184500 | local-only | no matching DEV history row |
| 20260805185000 | local-only | no matching DEV history row |
| 20260805200000 | local-only | no matching DEV history row |
| 20260805203000 | local-only | no matching DEV history row |
| 20260805203100 | local-only | no matching DEV history row |
| 20260805203200 | local-only | no matching DEV history row |
| 20260805210000 | local-only | no matching DEV history row |
| 20260805210100 | local-only | no matching DEV history row |
| 20260805210200 | local-only | no matching DEV history row |
| 20260805210300 | local-only | no matching DEV history row |
| 20260805210400 | local-only | no matching DEV history row |
| 20260805210500 | local-only | no matching DEV history row |
| 20260805210600 | local-only | no matching DEV history row |
| 20260805210700 | local-only | no matching DEV history row |
| 20260805210800 | local-only | no matching DEV history row |
| 20260806101419 | local-only | no matching DEV history row |
| 20260806120000 | local-only | no matching DEV history row |
| 20260806133314 | local-only | no matching DEV history row |
| 20260806133600 | local-only | no matching DEV history row |
| 20260806160000 | local-only | no matching DEV history row |
| 20260806161000 | local-only | no matching DEV history row |
| 20260806180000 | local-only | no matching DEV history row |
| 20260807100345 | local-only | no matching DEV history row |
| 20260807100842 | local-only | no matching DEV history row |
| 20260807103107 | local-only | no matching DEV history row |
| 20260807104155 | local-only | no matching DEV history row |
| 20260807130219 | local-only | no matching DEV history row |
| 20260807133846 | local-only | no matching DEV history row |
| 20260807141014 | local-only | no matching DEV history row |
| 20260807145526 | local-only | no matching DEV history row |
| 20260807151500 | local-only | no matching DEV history row |
| 20260807161323 | local-only | no matching DEV history row |
| 20260807162539 | local-only | no matching DEV history row |
| 20260807183000 | local-only | no matching DEV history row |
| 20260807193000 | local-only | no matching DEV history row |
| 20260808121033 | local-only | no matching DEV history row |
| 20260808123429 | local-only | no matching DEV history row |
| 20260808124952 | local-only | no matching DEV history row |
| 20260808125227 | local-only | no matching DEV history row |
| 20260808130657 | local-only | no matching DEV history row |
| 20260808135322 | local-only | no matching DEV history row |
| 20260808142808 | local-only | no matching DEV history row |
| 20260808144955 | local-only | no matching DEV history row |
| 20260808151400 | local-only | no matching DEV history row |
| 20260808151500 | local-only | no matching DEV history row |
| 20260808151600 | local-only | no matching DEV history row |
| 20260808151700 | local-only | no matching DEV history row |
| 20260808151800 | local-only | no matching DEV history row |
| 20260808151900 | local-only | no matching DEV history row |
| 20260808152000 | local-only | no matching DEV history row |
| 20260808152100 | local-only | no matching DEV history row |
| 20260808152200 | local-only | no matching DEV history row |
| 20260808152300 | local-only | no matching DEV history row |
| 20260808152400 | local-only | no matching DEV history row |
| 20260808162000 | local-only | no matching DEV history row |
| 20260808170000 | local-only | no matching DEV history row |
| 20260808170100 | local-only | no matching DEV history row |
| 20260808170200 | local-only | no matching DEV history row |
| 20260808170300 | local-only | no matching DEV history row |
| 20260808170400 | local-only | no matching DEV history row |
| 20260808170500 | local-only | no matching DEV history row |
| 20260808170600 | local-only | no matching DEV history row |
| 20260808170700 | local-only | no matching DEV history row |
| 20260808170800 | local-only | no matching DEV history row |
| 20260808170900 | local-only | no matching DEV history row |
| 20260808171000 | local-only | no matching DEV history row |
| 20260808171100 | local-only | no matching DEV history row |
| 20260808171200 | local-only | no matching DEV history row |
| 20260809070000 | local-only | no matching DEV history row |
| 20260809071100 | local-only | no matching DEV history row |
| 20260809100000 | local-only | no matching DEV history row |
| 20260809100500 | local-only | no matching DEV history row |
| 20260809101000 | local-only | no matching DEV history row |
| 20260809110000 | local-only | no matching DEV history row |
| 20260809183000 | local-only | no matching DEV history row |
| 20260809184500 | local-only | no matching DEV history row |
| 20260809191000 | local-only | no matching DEV history row |
| 20260809192000 | local-only | no matching DEV history row |
| 20260809193000 | local-only | no matching DEV history row |
| 20260809200000 | local-only | no matching DEV history row |
| 20260810070154 | local-only | no matching DEV history row |
| 20260810070300 | local-only | no matching DEV history row |
| 20260810070400 | local-only | no matching DEV history row |
| 20260810073000 | local-only | no matching DEV history row |
| 20260810073100 | local-only | no matching DEV history row |
| 20260810100000 | local-only | no matching DEV history row |
| 20260810103000 | local-only | no matching DEV history row |
| 20260810120000 | local-only | no matching DEV history row |
| 20260810120001 | local-only | no matching DEV history row |
| 20260810120002 | local-only | no matching DEV history row |
| 20260810154131 | local-only | no matching DEV history row |
| 20260810173000 | local-only | no matching DEV history row |
| 20260810193500 | local-only | no matching DEV history row |
| 20260810195000 | local-only | no matching DEV history row |
| 20260810200500 | local-only | no matching DEV history row |
| 20260811155020 | local-only | no matching DEV history row |
| 20260811161320 | local-only | no matching DEV history row |
| 20260811163500 | local-only | no matching DEV history row |
| 20260811174452 | local-only | no matching DEV history row |
| 20260812054853 | local-only | no matching DEV history row |
| 20260812110000 | local-only | no matching DEV history row |
| 20260812130813 | local-only | no matching DEV history row |
| 20260812150000 | local-only | no matching DEV history row |
| 20260812160000 | local-only | no matching DEV history row |
| 20260812161000 | local-only | no matching DEV history row |
| 20260813102722 | local-only | no matching DEV history row |
| 20260813102725 | local-only | no matching DEV history row |
| 20260813105706 | local-only | no matching DEV history row |
| 20260813110008 | local-only | no matching DEV history row |
| 20260813113105 | local-only | no matching DEV history row |
| 20260813115443 | local-only | no matching DEV history row |
| 20260813131401 | local-only | no matching DEV history row |
| 20260813131411 | local-only | no matching DEV history row |
| 20260813144143 | local-only | no matching DEV history row |
| 20260814065647 | local-only | no matching DEV history row |
| 20260814071817 | local-only | no matching DEV history row |
| 20260814072035 | local-only | no matching DEV history row |
| 20260814072427 | local-only | no matching DEV history row |
| 20260814073110 | local-only | no matching DEV history row |
| 20260814073642 | local-only | no matching DEV history row |
| 20260814074728 | local-only | no matching DEV history row |
| 20260814075144 | local-only | no matching DEV history row |
| 20260814075803 | local-only | no matching DEV history row |
| 20260814115318 | local-only | no matching DEV history row |
| 20260814134010 | local-only | no matching DEV history row |
| 20260814135815 | local-only | no matching DEV history row |
| 20260814161500 | local-only | no matching DEV history row |
| 20260814170000 | local-only | no matching DEV history row |
| 20260814183000 | local-only | no matching DEV history row |
| 20260815090000 | local-only | no matching DEV history row |
| 20260816102000 | local-only | no matching DEV history row |
| 20260816103500 | local-only | no matching DEV history row |
| 20260816111000 | local-only | no matching DEV history row |
| 20260816114000 | local-only | no matching DEV history row |
| 20260816114500 | local-only | no matching DEV history row |
| 20260816123000 | local-only | no matching DEV history row |
| 20260816140854 | local-only | no matching DEV history row |
| 20260821150000 | local-only | no matching DEV history row |
| 20260823073015 | local-only | no matching DEV history row |
| 20260823110000 | local-only | no matching DEV history row |
| 20260823172440 | local-only | no matching DEV history row |
| 20260828070140 | local-only | no matching DEV history row |
| 20260828090000 | local-only | no matching DEV history row |
| 20260828115844 | local-only | no matching DEV history row |
| 20260828162449 | local-only | no matching DEV history row |
| 20260829154355 | local-only | no matching DEV history row |
| 20260830143757 | local-only | no matching DEV history row |
| 20260831151639 | local-only | no matching DEV history row |
| 20260902090000 | local-only | no matching DEV history row |
| 20260902113235 | local-only | no matching DEV history row |
| 20260902132228 | local-only | no matching DEV history row |
| 20260902133055 | local-only | no matching DEV history row |
| 20260903103132 | local-only | no matching DEV history row |
| 20260903121602 | local-only | no matching DEV history row |
| 20260904100000 | local-only | no matching DEV history row |
| 20260904130000 | local-only | no matching DEV history row |
| 20260904150000 | local-only | no matching DEV history row |
| 20260904153000 | local-only | no matching DEV history row |
| 20260904160000 | local-only | no matching DEV history row |
| 20260904170000 | local-only | no matching DEV history row |
| 20260904173000 | local-only | no matching DEV history row |
| 20260904180000 | local-only | no matching DEV history row |
| 20260907071315 | local-only | no matching DEV history row |
| 20260907160000 | local-only | no matching DEV history row |
| 20260911100000 | local-only | no matching DEV history row |
| 20260912072624 | local-only | no matching DEV history row |
| 20260912074130 | local-only | no matching DEV history row |
| 20260912120000 | local-only | no matching DEV history row |
| 20260912145426 | local-only | no matching DEV history row |
| 20260912160000 | local-only | no matching DEV history row |
| 20260912193500 | local-only | no matching DEV history row |
| 20260913090000 | local-only | no matching DEV history row |
| 20260913100000 | local-only | no matching DEV history row |
| 20260914100000 | local-only | no matching DEV history row |
| 20260914110000 | local-only | no matching DEV history row |
| 20260915122119 | local-only | no matching DEV history row |
| 20260915140000 | local-only | no matching DEV history row |
| 20260915193000 | local-only | no matching DEV history row |
| 20260918203815 | local-only | no matching DEV history row |

## Persona acceptance index

| Persona | Scenario | Result | Screenshot filename | Business state / gate |
| --- | --- | --- | --- | --- |
| HR Admin | Enable self-report setting and wording | ENVIRONMENT-GATED | — | Requires DEV migration/settings readback |
| HR Admin | Confirm employee sickness and administrative correction | ENVIRONMENT-GATED | — | Requires pending confirmation state |
| HR Admin | Direct sickness, expected return, recovery without Act-as | ENVIRONMENT-GATED | — | Requires canonical DEV absence state |
| Employee | Self-report: first sickness date only | ENVIRONMENT-GATED | — | Requires enabled setting and DEV persistence |
| Employee | No expected return and no recovery action | ENVIRONMENT-GATED | — | Local contract covered; browser/DEV gate not run |
| Employee | Leave request and Mijn aanvragen | ENVIRONMENT-GATED | — | Leave positive path not started |
| Employee | Team privacy and Who-is-Who | ENVIRONMENT-GATED | — | Requires DEV projection readback |
| Employee | Permitted profile first/preferred-name edit | ENVIRONMENT-GATED | — | Persona acceptance not started |
| Manager | Pending sickness in Mijn werk and confirmation | ENVIRONMENT-GATED | — | Requires DEV pending work item |
| Manager | Manager Home: Ziek in mijn team | ENVIRONMENT-GATED | — | Requires DEV Manager Home readback |
| Manager | Direct team sickness, expected return, recovery | ENVIRONMENT-GATED | — | Requires canonical DEV absence state |
| Manager | Leave approval and canonical booking exactly once | ENVIRONMENT-GATED | — | Leave hard gate not started |
| Manager | Manager Home: Op vakantie deze week | ENVIRONMENT-GATED | — | Requires approved DEV leave allocation |
| Manager | Team calendar | ENVIRONMENT-GATED | — | Requires DEV calendar projection |
| Downstream | HR employee/absence views and reports | ENVIRONMENT-GATED | — | Requires migration readback and persona run |
| Downstream | Manager Team/Work/Home projections after transitions | ENVIRONMENT-GATED | — | Requires DEV business mutations |
| Downstream | Employee colleague privacy projection | ENVIRONMENT-GATED | — | Requires DEV privacy negative checks |

## Next safe action

Recover the exact historical migration bodies for the remote-only versions from the authoritative repository/archive, or provide an explicitly approved migration-history reconciliation procedure based on that authoritative source. Do not apply the current Focus migration until the pending set contains only safely reconciled history plus the legitimate candidate migration.
