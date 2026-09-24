# AWS career sandbox agent steering

Read `README.md`, `docs/architecture.md`, and `docs/runbook.md` before changing infrastructure.

This repository is deliberately bounded: synthesize and test infrastructure, but do not create running product compute or broaden scope beyond the documented sandbox.

AI may directly handle reversible code, tests, CDK refactors, documentation, and CI mechanics. Deployment is consequential: do not run `cdk bootstrap`, `cdk deploy`, or otherwise create/modify AWS resources outside the approved GitHub Actions deployment path.

Verify with `npm run validate`. Do not claim resources are deployed or live from synthesis output alone.
