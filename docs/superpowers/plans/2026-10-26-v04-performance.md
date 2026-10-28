# MoonMetamath 0.4 measured performance plan

User approved stage2 on2026-10-26: small/medium/large real-database baseline, only measurement-justified optimization, unified kernel and legacy compatibility, tests/review/release/acceptance without repeated approval.

**Goal:** Reproducible bounded performance measurements and necessary improvements, released as0.4.0.
**Architecture:** Existing native core/JSON boundary. No assumed incremental verifier, platform, model calls or training.
**Tech:** pinned existing MoonBit, Node24 primary JS product path, Windows machine; preserve existing dual-backend semantic tests and Windows/Linux release CI.
**Spec:** This approved stage2 plan and PROJECT.md correctness/compatibility requirements.

## Measurement contract

- Freeze v0.3.0 built JS before core edits, record git revision and artifact SHA. Compare same hardware/Node/toolchain/database/limits/workload; do not compare different budgets as speedups.
- Official metamath/set.mm commit b4c3130f3b8081e1e4a33b47321141359e3380ae: hol.mm small96899bytes, nf.mm medium2985101bytes, set.mm large51737997bytes. Verify pinned Git blob identities and SHA256; retain upstream license and header. Large sources remain ignored, only acquisition lock tracked.
- Run one child process at a time. Initial production-like profile:512MiB V8 old-space,120s total deadline, unchanged core default limits. Peak RSS is process high-water mark, not kernel-only memory or total hard cap.
- Measure read/serialization/load/verify separately and fixed query/preview/create_goal/rewind workloads after successful verify. Candidate target and proof actions must be deterministically fixed in lock, same before/after; no target chosen from future performance results.
- Three fresh-process repetitions for completed workloads; first failure/OOM/deadline is retained and stops repetitive retries of that cell. Status distinguishes invalid/incomplete/resource_limit/oom/timeout/host failure. Failed phases have no invented duration or speedup. An explicitly labelled larger diagnostic profile is allowed only to locate a failed baseline bottleneck, never substituted for the unchanged-budget comparison.
- Capture environment, raw per-phase rows, counts, outcomes, resource profile, cold-process status and summaries (median/range); process startup and file I/O distinct from dispatch timings. Small fixed call batches report repeats, no claim of rigorous statistical significance from3samples.
- Independently verify each unmodified database with pinned official C, record actual proof counts/output. Preserve existing known language-boundary disagreements separately.

## Work units / ownership

1. Root acquisition/provenance and independent reference; delegate benchmark harness only (scripts/performance*.mjs, tests/host/performance.test.mjs). Root owns lock/docs/wrappers/CI/version/release. Core inspector is read-only until baseline evidence exists.
2. Execute baseline, localize dominant failure/cost with bounded profiling or structural count evidence. Record selected minimal optimization and rejected alternatives in ledger before implementation.
3. Implement measured core changes using focused semantic regression tests; shared executor and old root/src/core APIs/limits/diagnostic semantics preserved. Do not loosen validation, counts, source inputs or acceptance expectations to improve timing.
4. Re-run same harness/budgets/artifacts, report failures as such. Optimize only identified bottlenecks; stop after practical measured improvement and required semantic gates, not endless tuning.
5. Full existing checks, old notebooks/consumers/downstream, actual browser, independent export, package and independent final review. Publish original GitHub/Mooncakes/Pages; validate exact source CI, registry/public site/archive. Archive sanitized benchmark rows/report with release, update PROJECT/PROGRESS/reuse index and stop temporary processes.

## Review focus

- Valid/incomplete/resource outcomes and mandatory hypothesis/disjoint/scope ordering unchanged.
- Optimizations cannot expose mutable aliases or accept unverified/self/future premises.
- Memory accounting and deadlines cover failed cells; missing phase is never zero.
- Comparison artifact/source provenance and identical workload/budget assertions.
- Heavy benchmarks not silently run in ordinary CI or model workflows; a small harness smoke/contract test is enough there.

## Progress

- [x] Acquire fixed sources and baseline harness; validate measurement negative controls.
- [x] Record baseline and bottleneck evidence.
- [x] Implement only justified optimization and compare.
- [x] Complete review/tests/publish/actual acceptance and report.
