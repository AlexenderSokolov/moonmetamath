# Browser product smoke checklist

Status: **NOT RUN**. The web author completed only JavaScript syntax checks. Root integration must record actual browser, date, results, screenshots and downloaded artifact path before marking steps passed.

Serve repository root with the project's Node host and open `/web/`. No build framework or external runtime dependency is required; `dist/moonmetamath-core.mjs` and the acquired real fixtures must exist.

| Step | Expected behavior | Result |
| --- | --- | --- |
| Open `/web/` | demo0 loads, is verified by native core, theorem `th1` is selected with empty construction stack and real active hypotheses | NOT RUN |
| Apply `unknown-label` | Shows core diagnostic. Stack, successful count and history stay unchanged. Dismiss closes error | NOT RUN |
| Apply `tt`, then rewind | Native state shows one expression, then returns to empty stack and zero successful steps | NOT RUN |
| Use Replay tab and run replay | Clearly labeled original-proof replay; starts at position zero, next/range/label navigation shows checked event details | NOT RUN |
| Return to Construct tab | Existing manual construction remains separate from replay, with no original proof automatically applied | NOT RUN |
| Construct demo0 th1 | Apply source proof labels manually; final `finish` succeeds; export becomes enabled | NOT RUN |
| Download `.mm` | Browser downloads a self-contained normal proof under a fresh theorem label; record path and independently verify it | NOT RUN |
| Restart and early finish | Restart returns empty stack; premature finish shows diagnostic and keeps editable state | NOT RUN |
| Load MIU and HOL | Each fixture loads/verifies with actual outcome/counts and selectable target; no parse-only success shown as verified | NOT RUN |
| Upload include fixtures together | Select entry explicitly, load only uploaded collection; valid relative includes resolve, missing includes show host/core diagnostic | NOT RUN |
| Upload BOM/non-ASCII/control-character source | Encoding error is visible; unsupported bytes are never silently replaced | NOT RUN |
| Cancel a running operation | Worker is terminated, old view is read-only and handles cannot be used; reloading creates fresh worker and session | NOT RUN |
| Narrow viewport / keyboard | Sidebar and panels remain usable; all controls have labels and visible keyboard focus; no horizontal page overflow | NOT RUN |

Demo0 original source proof for manual acceptance (34 labels; consult pinned file rather than claiming a model created it):

```text
tt tze tpl tt weq tt tt weq tt a2 tt tze tpl tt weq tt tze tpl tt weq tt tt weq wim tt a2 tt tze tpl tt tt a1 mp mp
```

Rendering and all mathematical verdicts come from native core responses; replay prefix display uses already checked core events. No model endpoint is called. Uploaded source text is kept in memory only. Cancellation discards native handles and requires reload.
