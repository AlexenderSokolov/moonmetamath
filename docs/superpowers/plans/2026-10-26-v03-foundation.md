# MoonMetamath 0.3 Foundation Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development with disjoint ownership and independent review; user authorized uninterrupted implementation and publication.

**Goal:** Deliver the approved long-running library foundation and independent consumer through tested public release.
**Architecture:** Retain one MoonBit semantic executor; explicit engine owns wire handles. Host/UI consume additive schema-1 lifecycle operations; notebook stays replay-based.
**Tech Stack:** Existing pinned MoonBit, Node24, JS/wasm-gc; Playwright 1.64.1 development tests.
**Spec:** docs/superpowers/specs/2026-10-26-long-term-foundation.md

## Global Constraints

- Preserve schema 1, dispatch_json, src/core public interfaces, old operation inputs and diagnostic codes.
- No duplicate proof checker, platform, model calls, training, full set.mm work, deletion, global-toolchain changes or changes to sibling projects.
- Product remains free of npm runtime dependencies. User authorizes original-repository release, registry and Pages.
- Native fields remain private. Unverified/self/future theorem restrictions and atomic failed steps stay intact.
- Work in existing independent project on codex/moonmetamath-v0.3, preserve all old artifacts.

## Review Focus

- Cross-instance/expired handles never address a different resource (T1).
- Failed unload/target switch preserves current proof and quotas (T1/T2).
- Low-budget reverify does not grant unverified evidence or revoke earlier immutable evidence (T1).
- Frozen old notebooks restore without trusting saved state; cancellation cannot resurrect state (T3/T2).
- Browser evidence belongs to tested assets; released consumer uses registry rather than source fallback (T3).

### Task 1: Core lifecycle and compatibility facade

Files: src/core/dispatch.mbt, verifier.mbt and focused tests; api.mbt, moon.pkg; generated .mbti; src/js_bridge if needed.
Produces: root opaque Engine/new_engine/dispatch_engine; JS create_dispatcher factory; close_session and unload_database per spec. Keep old default dispatcher.
- [ ] Add failing tests for independent engines, cross/expired handles, release/reuse beyond64, busy database, reset isolation, resource classification, reverify/export.
- [ ] Implement smallest core owner and lifecycle operations; preserve immutable verification evidence while reports reflect current run.
- [ ] Update generated interfaces, run format/check/test both backends, build JS and legacy tests once integrated. Record exact red/green evidence.
- [ ] Self-review and return owned-file diff plus evidence; root owns commits/release.

### Task 2: Host/UI integration and browser regression

Files: bin/host.mjs, web/app.mjs, web/worker.mjs, tests/host/lifecycle.test.mjs, tests/web/foundation.spec.mjs, playwright.config.mjs, package.json/package-lock.json.
Consumes: JS create_dispatcher returns function; lifecycle operations from T1. Produces npm run test:web and actual browser evidence under artifacts/browser-v03.
- [ ] Add failing tests for coreClient isolation and repeated/failed target switch.
- [ ] Make coreClient isolated, add atomic target/new-goal ownership transitions with cleanup and epoch checks.
- [ ] Add Playwright dev-only pinned dependency and real DOM/Worker tests for >64 restarts, failed switch preserves work, save/restore including bad document, cancellation/late response and downloaded valid proof.
- [ ] Run focused tests and browser suite after core build; preserve failures and evidence; no source-shape-only tests.
- [ ] Return owned-file diff/evidence, root owns CI/acceptance/scripts/commits.

### Task 3: Frozen compatibility, independent consumer, release evidence

Files: tests/fixtures/notebooks/v0.2.0, tests/host/compatibility.test.mjs, examples/downstream, scripts/downstream.mjs, scripts/browser-receipt.mjs, scripts/acceptance.mjs, scripts/package.mjs, CI, run_* wrappers, README/API/COMPATIBILITY/CHANGELOG/PROJECT/PROGRESS and reuse notes.
- [ ] Generate frozen notebook samples using git-tagged0.2.0 writer, retain provenance and expected state; run old-format replay and independent export checks.
- [ ] Build standalone public-API consumer, run local workspace and JS/wasm-gc, later registry exact0.3.0; include source/example in release.
- [ ] Bind browser receipt to tested assets with mismatch negative-control test; wire automated browser gate before Pages. Keep historical release check separate from current latest checks where needed.
- [ ] Run integrated checks/consumer/browser/independent oracle/package, resolve independent task and whole-branch review findings.
- [ ] Commit reviewed version0.3.0; publish original repo, Mooncakes, Release/Pages; verify actual CI, registry, downloaded archive and public assets/browser.
- [ ] Update PROGRESS/PROJECT/reuse only from actual receipts, stop temporary services and finish.
