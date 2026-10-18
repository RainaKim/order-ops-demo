---
name: pr-preflight
description: Review a proposed pull request against the repository preflight checklist, approved scope, policies, diff, and verification results. Use for PR readiness checks, not for implementing changes or publishing a PR.
---

# PR preflight

Review a specified change using `docs/checklists/pr-preflight.md` as the authoritative checklist and applicable repository instructions. This skill produces evidence for a person to review; it does not approve a PR.

## Input and scope

Obtain the target, baseline, relevant working-tree/staged or PR diff, approved plan and scope, applicable policy documents, and relevant test evidence. Treat paths, revisions and logs as run-specific. Inspect tracked and untracked changes without treating unrelated work as part of the approved scope. If a PR diff or an approval is unavailable, say so; do not substitute a local diff for it or infer approval. Read `notes/preflight-run-l16.md` and the preflight section of `notes/role-split-run-l17.md` only as examples of evidence and reporting, not as current results or approvals.

## Procedure

1. Read the checklist and inspect the provided inputs. For each of Scope, Policy, Tests, Lint, Typecheck, Diff, and Failure handling, compare the relevant evidence with the checklist and record an independent result. Identify policy requirements, unresolved decisions, and tests marked as expected failures separately.
2. Run the repository's relevant verification commands where allowed; record each command, exit status, and actual outcome. Follow repository instructions for tests requiring a local HTTP server and for GitHub access. A successful command does not establish that an expected-failure test or a policy passes. Never infer automated or Scheduled permissions from a successful ordinary session.
3. Stop the affected checks on missing inputs, unclear scope, policy conflict or deferral, test failure, or insufficient permission. Preserve the last completed step and worktree state; do not assume an approval or retry with broader access. In an unattended run, report the blocker and stop rather than waiting for approval.
4. Report each checklist item with evidence paths, command results where applicable, and pass, blocked, failed, or not run. Include the target and baseline, changes observed, expected failures, unverified scope, remaining risks, required permissions and decisions, and the last completed step. Mark overall readiness as pending where evidence or a person's decision is missing.

## Human decisions and boundaries

A person decides scope, policy and expected-failure treatment, and final PR readiness; identify the decision and evidence needed to resume. Do not edit application or test files, stage, commit, publish, or perform external writes as part of preflight. Do not include secrets or sensitive raw log content in the report. If a report file is explicitly requested, write only to its authorized workspace path; otherwise report in the session. Do not claim delivery of an external alert: a blocked run must leave the above information in its report.
