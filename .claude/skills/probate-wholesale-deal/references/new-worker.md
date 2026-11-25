# Creating a new worker

Learning (`references/learning.md`) adds rules to an existing worker. This file is for when a **new worker** is needed. A worker is a role file in `agents/` that some step of the run hands work to.

## When a new worker is justified
Create one only when **all three** hold:
1. **Recurring gap:** the same kind of work is missing or done badly in at least 3 leads or 2 runs (e.g. "taxes not checked" in many `title.md` files, placeholders in drafts, an error class QA can't see).
2. **No owner:** no existing role's file says it does this work. If one does but it's skipped, fix that role or its run step first; don't add a duplicate.
3. **Distinct output:** the new worker writes something specific that others read (a file per lead, a column in the tracker, a pipeline file).

Otherwise, add a `## Learned` rule to the closest existing role.

## Owner approval
A new worker that would **spend money, change a cap or threshold, sign, or touch the Hard limits** needs the owner's written OK first: hand the proposal to the Exceptions Desk, which escalates it, and stop there. Any other worker, including one whose output will feed messages that Communications sends through the Compliance gate, can be created by the runner. It starts in `trial` (shadow mode) and is enabled only when its measured results meet the thresholds (`references/worker-lifecycle.md`); list it under **What the team learned**.

## The role file (`agents/<kebab-name>.md`)
Use this shape (keep it under ~40 lines):
```
# Role: <Name>

<One paragraph: the single question this worker answers, and why it matters to closing deals.>

## For each <lead / market / run>
1. <Steps, using only sources marked `works` in pipeline/coverage.csv, or adding new ones via the Source Mapper.>
2. <Write <exact output file or columns>, labelling every line verified (source + date) or assumed.>

## Stop and flag
<When to stop and put it under Exceptions instead of guessing.>

Follow `references/learning.md` when you meet a situation these steps don't cover.

## Handoffs
(Copy the Handoffs section from any existing role file and change the worker name. It lists your open items at the start of your step and asks other workers instead of guessing.)

## Self-review
(Copy the Self-review section from any existing role file.)

## Learned
```

## Wiring checklist (a worker isn't live until every box is done)
1. **Roster:** add a row to the team table in `SKILL.md`.
2. **Run plan:** add it to `references/orchestration.md` (team table) **and** to the step in `references/daily-run.md` where it runs, naming its output file.
3. **Measured:** add a `W(...)` row to the workers block in `scripts/build_dashboard_data.py`, counting work done and results from its output files, so it appears in Worker performance on the dashboard.
4. **QA:** `scripts/qa_checks.py` already fails if a role file in `agents/` is missing from the roster or from `workers.csv`. Run it.
5. **Handoffs and self-review:** the role file has both sections (QA fails without them). The new worker joins the handoff board automatically: `scripts/handoffs.py` reads the list of workers from `agents/*.md`. Tell the workers it will take questions from (in their role files' steps) what to send it.
6. **Lifecycle:** `python3 scripts/worker_lifecycle.py register <name>`. It starts in `trial`: write its run step as "shadow: output to `pipeline/trials/<name>/<date>/`", name its checker (the Quality Auditor's re-verification or the active worker that does the same job) in its role file, and have the Quality Auditor score it every run it works. QA fails while `agents/` and `pipeline/workers.csv` disagree. Promotion to `active` is automatic (runbook step 7c); then remove "shadow" from its step.
7. **Report:** announce the new worker in the daily report under **What the team learned**, with the evidence that justified it.
