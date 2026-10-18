# Offline quality evidence

`.quality/system.json` declares the real checks, source inputs and all eight
dimensions for this repository. The maintained `ai-governance` runner records
actual command exits/timeouts and hashes; evidence is retained by validation CI.

A successful scoped CI result does not establish release or production readiness.
Operations and outcome evidence remain explicitly unverified, and partial
dimensions retain their concrete gaps and next checks. Existing human merge,
deployment and provider boundaries remain unchanged. No credentials or private
runtime data are needed by this validation job.

The shared runner/action is pinned to an immutable reviewed source revision.
Run its `run` and `validate --mode ci` entrypoints against this definition to
produce/validate `.quality-results/assessment.json`; readiness validation must
reject these partial/unverified intended-use claims.

The real stack job is named `validate`. The required `ai-governance / verdict`
comes from the pinned authoritative reusable workflow, not a local lookalike.
Its caller uses `needs: validate`, `if: always()` and the actual
`needs.validate.result` as `prerequisite-result`; failure, cancellation or skip
cannot become a successful authoritative verdict. The reusable quality job is
skipped only because `validate` performs the actual complete declared checks.
The policy and secret-scan jobs still execute. Ky alone merges governance work;
required check success is separate from a human merge/deployment decision.

Deployment remains manual-only and protected-environment approved on main.
Before the AWS credential step, a bounded GitHub API reader requires successful
latest `validate` and `ai-governance / verdict` checks from GitHub Actions for
the exact deployment revision. Missing, stale-attempt, pending, skipped, failed,
wrong-head or wrong-app checks fail closed. Unit tests use mocked API responses;
no deployment, AWS access or live approval was exercised by those tests. The
helper relies on GitHub's trusted workflow context and environment protections;
it does not independently authenticate a human.
