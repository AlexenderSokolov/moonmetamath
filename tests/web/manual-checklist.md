# Browser product smoke checklist

Status: **Required product flows passed in an actual Chromium browser, 2026-10-23.** Evidence is recorded in local `artifacts/browser/receipt.json`; the downloaded `browser-th1.mm` was independently accepted by the fixed official C verifier (`downloaded-proof-c/result.json`, with actual VERIFY PROOF command/output). Screenshot: `artifacts/browser/constructed-th1.png`. Narrow viewport/complete keyboard audit remains untested and is not counted as passed.

Serve repository root with the project's Node host and open `/web/`. No build framework or external runtime dependency is required; `dist/moonmetamath-core.mjs` and the acquired real fixtures must exist.

| Step | Expected behavior | Result |
| --- | --- | --- |
| Open `/web/` | demo0 loads, is verified by native core, theorem `th1` is selected with empty construction stack and real active hypotheses | PASS |
| Apply `unknown-label` | Shows core diagnostic. Stack, successful count and history stay unchanged. Dismiss closes error | PASS |
| Apply `tt`, then rewind | Native state shows one expression, then returns to empty stack and zero successful steps | PASS |
| Use Replay tab and run replay | Clearly labeled original-proof replay; starts at position zero, next/range/label navigation shows checked event details | PASS: 34 checked events |
| Return to Construct tab | Existing manual construction remains separate from replay, with no original proof automatically applied | PASS: empty construction remained |
| Construct demo0 th1 | Apply source proof labels manually; final `finish` succeeds; export becomes enabled | PASS: 34 UI actions and finish |
| Download `.mm` | Browser downloads a self-contained normal proof under a fresh theorem label; record path and independently verify it | PASS: moonmm-browser-th1.mm, official C valid |
| Restart and early finish | Restart returns empty stack; premature finish shows diagnostic and keeps editable state | PASS: EmptyFinalStack |
| Load MIU and HOL | Each fixture loads/verifies with actual outcome/counts and selectable target; no parse-only success shown as verified | PASS: MIU1, HOL151 |
| Upload include fixtures together | Select entry explicitly, load only uploaded collection; valid relative includes resolve, missing includes show host/core diagnostic | PASS: two files, th verified; missing include covered by core fixtures |
| Upload BOM/non-ASCII/control-character source | Encoding error is visible; unsupported bytes are never silently replaced | PASS: BOM rejected at byte0; other bytes in core tests |
| Cancel a running operation | Worker is terminated, old view is read-only and handles cannot be used; reloading creates fresh worker and session | PASS: 20000-growth proof cancelled; demo0 reloaded and verified |
| Narrow viewport / keyboard | Sidebar and panels remain usable; all controls have labels and visible keyboard focus; no horizontal page overflow | NOT RUN |

Demo0 original source proof for manual acceptance (34 labels; consult pinned file rather than claiming a model created it):

```text
tt tze tpl tt weq tt tt weq tt a2 tt tze tpl tt weq tt tze tpl tt weq tt tt weq wim tt a2 tt tze tpl tt tt a1 mp mp
```

Rendering and all mathematical verdicts come from native core responses; replay prefix display uses already checked core events. No model endpoint is called. Uploaded source text is kept in memory only. Cancellation discards native handles and requires reload.
