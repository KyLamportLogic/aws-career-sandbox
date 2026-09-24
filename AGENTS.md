# AWS career sandbox agent contract

This repository is a bounded portfolio sandbox, not a production application.

- Read `README.md`, `docs/architecture.md`, and `docs/runbook.md` before changing infrastructure.
- Keep the project intentionally non-running: no ECS service/RunTask path, VPC/NAT/load balancer, database, cache, secrets store, Bedrock resource, or DNS mutation unless the human explicitly changes that scope.
- Local work may type-check, test, and synthesize. Do not run `cdk bootstrap` or `cdk deploy` from an agent/local shell.
- Deployment is consequential. Only the manual GitHub Actions workflow with the protected environment/OIDC boundary may perform it, after human approval.
- Keep AWS permissions least-privilege and preserve the explicit deny posture that prevents running compute and network expansion.
- Do not turn account IDs, synthesized resources, or successful tests into claims that a workload is running.
- Prefer small CDK changes with tests that assert the intended IAM/resource boundary.
