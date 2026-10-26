# Reproducible real-database performance measurements

`databases.lock.json` fixes three complete upstream databases, their bytes/Git blobs,
source commit/license and deterministic late-theorem workloads. Downloads stay in
ignored `.references/performance`; acquisition refuses modified cache bytes.

```sh
node scripts/fetch-performance-data.mjs
node scripts/build.mjs
node scripts/performance.mjs --engine dist/moonmetamath-core.mjs --datasets hol,nf,set --mode verify --out artifacts/performance-default
node scripts/performance.mjs --engine dist/moonmetamath-core.mjs --datasets hol,nf --mode workbench --out artifacts/performance-workbench
```

Each output directory must be new. Default: three fresh Node processes sequentially,
512 MiB V8 old-space, 120 s whole-child deadline, unchanged native limits. Stop each
cell on its first failure; failed phases are not zero-duration successes. RSS is
Node process high-water usage through workload completion, not kernel-only memory
or a hard total-process cap. Cold process does not imply cold filesystem cache.

The fixed workbench program searches rules five times, starts the last theorem,
previews a fixed active hypothesis five times, applies it once, inspects, rewinds
that prefix five times, rewinds to zero and creates the same original goal in its
context. This is a **partial construction workload**, not a completed new proof.

Full `set.mm` exceeds the unchanged default 10,000,000-operation budget. A separate
explicit corpus profile permits 100,000,000 operations; every row records it:

```sh
node scripts/performance.mjs --engine dist/moonmetamath-core.mjs --datasets set --mode verify --max-operations 100000000 --out artifacts/performance-full-set
```

The production defaults are not changed. `--heap-mib 2048` is available for an
explicitly labelled larger-memory diagnostic/comparison, never merged with the
512 MiB rows as a speedup. Use `--engine-meta` for saved-artifact build provenance;
metadata SHA must match actual artifact bytes. Engine and harness hashes, machine,
Node/toolchain, resource profile, per-phase journal and public proof counts are
recorded. Benchmark results are descriptive medians/ranges, not universal claims.

`run_performance.sh` / `.ps1` acquire pinned input, build and run these same commands.
Ordinary CI only tests the bounded runner and semantic regressions; it does not
download or benchmark the large corpus. See `docs/PERFORMANCE.md` for released
measurements, original failures, optimization decisions and reproduction details.
