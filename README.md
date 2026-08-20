# AWS career sandbox

A public, bounded portfolio project demonstrating AWS CDK, GitHub Actions OIDC,
human deployment approval, cost controls, ECR, an ECS task definition, IAM, and
CloudWatch Logs without creating running compute or product traffic.

The deployed assembly contains no ECS service or running task, VPC, NAT gateway,
load balancer, database, cache, secret, DNS record, or Bedrock resource. See
[Architecture](docs/architecture.md) and the [operator runbook](docs/runbook.md).

## Verify locally

```bash
npm ci
npm run validate
```

This performs strict type checking, unit and policy tests, cdk-nag checks, and
`cdk synth --strict`. Agents must not run `cdk bootstrap` or `cdk deploy` locally.

## Deployment boundary

Only the manual GitHub Actions workflow may deploy the CDK application. Its
deployment job targets the protected `aws-career-sandbox` environment, receives
OIDC permission only after environment approval, assumes
`BuildlogicCareerSandboxGitHubDeployRole`, runs a change-set-backed diff, and
uploads deployment evidence.

The one-time AWS trust ceremony is documented separately because OIDC cannot
create the role that is required to obtain OIDC credentials.

MIT licensed.
