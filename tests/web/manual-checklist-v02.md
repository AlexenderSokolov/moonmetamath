# MoonMetamath 0.2 browser acceptance

Status: NOT RUN by the frontend implementer. Integration owner must record the
actual browser, built core, origin, outcomes and any saved/exported evidence.
This checklist is a procedure, not a claim that browser acceptance has passed.

1. Load each of `examples/exercises/01-first-steps.mm`,
   `02-essential-hypothesis.mm`, `03-disjoint.mm` through the built-in selector.
   The database report should state one incomplete target; its construction can
   still start. Exercise guidance must match the selected source.
2. In exercise 01, search `->` (conclusion text) and typecode `|-`. Select
   `identity`: detail shows its `$f` mandatory hypothesis and conclusion. Neither
   the target nor future/invisible labels should appear. On a larger demo, check
   pagination and clearing the filter. No original proof appears in this browser.
3. Preview `identity` at an empty stack: failure leaves stack/history unchanged.
   Apply `wph`, preview `identity`: success displays the expected result but
   leaves the live stack/history unchanged. Apply the selected rule, finish.
4. Exercise 02: preview `lift` before providing its essential hypothesis. Apply
   `wph`, `premise`, `lift`; inspect readable mandatory `$f` and `$e` assumptions,
   finish and download `.mm` for independent verification.
5. Exercise 03: apply `vx`, `vx`, preview `pair-rule` and observe a disjoint
   diagnostic. Stack/history remain two items. Rewind once, apply `vy`, preview
   and apply `pair-rule`, then finish. Detail shows `$d x y`.
6. In exercise 03, create `swapped-pair` with `|- pair y x`. It starts incomplete
   with inherited `vx`, `vy` and `$d` constraints. Apply `vy`, `vx`, `pair-rule`,
   finish, export under a fresh label and verify with the independent checker.
   Empty goals, unknown tokens and duplicate labels should retain current work.
7. Apply two steps, rewind once, save `.json`. Its action list must contain only
   the retained successful prefix. Reload the page, click the visible restore
   last-save button, and confirm the same target, stack and one-step history.
   Continue and finish; save and import a completed work file as well.
8. With an active partial construction, import malformed JSON, a source hash
   mismatch, an invalid action and an incorrect completed flag in separate files.
   Every failure must preserve the active Worker/session, target, stack/history
   and ability to apply the next valid step.
9. Import a valid work file with many bounded actions and immediately cancel.
   Also cancel while a file is being read/hashed or candidate core is starting.
   Both active/candidate workers must terminate, no late candidate may resurrect
   a database, and reloading a built-in source must still work.
10. Save a work file exceeding 2 MiB (within the 128 MiB file limit): download is
    available, local last-save is not overwritten, and the notice explains this.
    Test denied/full local storage: file download/import remain usable.
11. Existing demo0 load, verify, target filtering, manual apply, rewind, finish,
    source upload, original-proof replay navigation and `.mm` export still work.
    Switching replay/construction must retain the manual construction. Saved work
    is available only from construction mode.
12. At 390 px and desktop widths, use keyboard focus/Enter for search, create
    goal and label application. Inspect visible labels, readable expressions,
    narrow-screen layout and no unexpected console/network errors.

## Evidence to fill after running

- Browser / version:
- Origin / build commit:
- Date:
- Passed checks:
- Failures / limitations:
- Independent export verification:
