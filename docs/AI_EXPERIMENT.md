# Bounded AI proof completion experiment

This local experiment tests whether a real language model can propose native
Metamath proof actions under a narrow information boundary. The fixed ten small
propositional exercises in `examples/ai/tasks.json` were written for this project.
Each file has exactly one incomplete target, with `$= ? $.` and no reference
proof. Categories include direct axioms, substitutions, active essential
hypotheses, modus ponens, a short inference chain, Hilbert identity and implication
composition. Some inference principles are supplied as axioms. These are exercises
under those declared axioms; they make no new mathematics claim. A model may know
classic results and their proof patterns from training.

The experiment is separate from the interactive browser and has no server,
training process or persistent scheduler. Implemented and locally tested does not
mean the real model experiment has run. Actual results are the dated artifact
directory produced by the command below, including failures.

## Information boundary

`bin/ai-policy.mjs` rebuilds the observation recursively from an explicit allowlist:

- Goal token array.
- Active hypothesis labels and token arrays.
- Current proof stack token arrays.
- Native `rules` results: label, kind, conclusion, mandatory hypothesis labels,
  kinds and expressions, and disjoint variable pairs.
- Execution feedback: action index and a short identifier code only.

The model receives none of the load, verify, inspect or rules wire envelopes,
database/session handles, raw sources, parser or verifier diagnostic messages,
notebooks, replay, legacy `list`, original proofs, target-as-premise labels or
future labels. A prior assertion's public rule label can legally also occur in an
original proof; the original proof sequence itself is never supplied. Native
`rules` enforces visibility and trust. The adapter never uses legacy `list`, whose
proof arrays are unsafe for policy observations. Tests plant original-proof
sentinels in nested records and diagnostics, and check a real compressed original
proof is exposed by legacy `list` but absent from the policy observation.

Only exact `{ "actions": [{ "operation": "apply_label", "label": "..." }] }`
objects are accepted. Unknown keys, unavailable labels, other operations and
oversized batches reject the entire batch before any prefix is applied. Actions
are then executed in order by MoonBit. A failed native application stops that
batch and supplies only its code on the next call. The policy cannot choose
arbitrary core operations or access native handles. The trusted runner performs
finish/export once the stack contains exactly the goal.

## Fixed budgets and comparison

Each model task permits at most two calls, at most 64 proposed actions per call,
120 seconds per call and 240 seconds overall. Transport failure and timeout end
the task; there are no automatic transport retries. An invalid action batch or
native application may use the remaining second call. Every declared task is
retained; failures are never dropped from the denominator. A timeout may consume
tokens even if the CLI never reports usage, so `usage_complete: false` means the
recorded token totals are partial. Complete accounting requires both
`input_tokens` and `output_tokens` to be nonnegative safe integers. Missing,
partial or invalid required counts make completeness false. Valid reported
fields are still accumulated individually; optional cached/reasoning counts do
not determine completeness, and invalid optional values are excluded from totals.

The simple baseline is breadth-first search over the same public rule labels and
native stack transitions. It sees no reference proof. Its fixed caps are 5,000
native `apply_label` attempts including replay of queued paths, proof depth 12,
240 seconds, at most six stack entries and at most 64 tokens per stack expression.
It deduplicates identical stacks. Baseline and model have different computational
budgets: this is a transparent small comparison, not a controlled claim of
algorithmic superiority. Baseline results and discovered actions are never passed
to the model.

Every candidate from either route is exported as a standalone `.mm` file and
checked independently by the pinned official C verifier through
`scripts/oracle.mjs`. Only its `valid` result counts as success. A native finish,
existing file or successful process exit alone is insufficient. The oracle's own
stdout, stderr and result record accompany every checked candidate.

`invalid_batches` counts schema/allowlist rejected batches; `invalid_actions`
counts individually invalid action records and native rejected applications;
`rejected_actions` also includes otherwise valid actions discarded with an invalid
batch. `attempted_actions` counts applications actually sent to MoonBit. Logs
record observations, model actions, safe execution feedback, call count, duration,
usage, provenance and warnings. Token totals sum reported usage only. Per-request
monetary cost is unknown for the ChatGPT subscription transport; no dollar amount
is inferred.

## Official Codex CLI transport

The real preflight used installed official Codex CLI 0.164.0 with existing ChatGPT
authentication. Direct OpenAI-compatible environment routes returned HTTP 401 in
that environment and were not used. The preflight was a readiness probe, not a
proof result. The adapter launches the JavaScript CLI entry with `process.execPath`
(required on Windows), requests `gpt-6.1-sol` with low reasoning effort and records
the requested model and transport. CLI JSONL does not expose the raw backend model
identifier, so provenance explicitly records `backend_model: "not_exposed"`.

Each call runs in a fresh OS temporary directory containing only a minimal
`AGENTS.md` and the strict response schema. The prompt goes through stdin. It does
not run from this repository. User configuration/rules are ignored; the session
is ephemeral, read-only, without repository discovery. Shell, apps, plugins,
browser use, computer use, multi-agent, image viewing and workspace dependency
tools are explicitly disabled, web search is disabled, and host skill discovery
is skipped. API key/base URL and common credential variables are removed from the
child environment to select the existing official authentication route. No global
configuration or authentication file is changed or logged.

The event parser accepts only assistant/reasoning/warning items and recognized
turn metadata; any tool or command execution item aborts and cannot count as a
model success. It requires a complete turn and exactly one structured assistant
response. Stderr warnings are retained with known credential values and
credential-bearing URLs redacted. Timeout termination includes the spawned process
tree on Windows. The temporary schema/policy directories are intentionally left
in place; this experiment does not delete files.

These controls constrain the configured model workflow. They do not make a claim
that the CLI process is an operating-system security sandbox against a malicious
CLI installation. The installed CLI is a trusted local dependency.

## Run and inspect

First build the native core and run focused tests:

```powershell
node scripts/build.mjs
node --test tests/host/ai.test.mjs
```

Run all ten fixed tasks once, using a fresh output directory:

```powershell
node bin/ai-experiment.mjs --out artifacts/ai-2026-10-23 `
  --codex-js C:/Users/20600/AppData/Roaming/npm/node_modules/@openai/codex/bin/codex.js `
  --model gpt-6.1-sol
```

Use `--baseline-only` to run the same fixed tasks without any model calls. There
is deliberately no task filter, retry count, target-proof override or repair loop.
The runner refuses to overwrite an existing declaration or per-route record.

`declaration.json` freezes the task identifiers, categories, exact source hashes,
prompt and budgets before the first task starts. Each task directory contains
`baseline.json` and `model.json` plus any candidate `.mm` and oracle records.
`results.json` checkpoints all completed tasks. `summary.json` reports the fixed
denominator, verified successes, failures, invalid actions, budget exhaustion,
timeouts, elapsed time and reported tokens. Read per-task records for transport,
schema, native execution and independent verifier failures.

An interrupted run has no final summary; its declaration and completed task files
remain evidence of that incomplete attempt. Re-running uses a new directory and
is a separate declared experiment, never an invisible continuation.
