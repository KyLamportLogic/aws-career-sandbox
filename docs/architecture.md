# Architecture

## Boundary

The sandbox is evidence infrastructure, not an application runtime. Account
`723949188045` and region `us-east-1` are public portfolio metadata.

The bootstrap stack owns or references GitHub's account-level OIDC provider,
creates `BuildlogicCareerSandboxGitHubDeployRole`, and creates
`BuildlogicCareerSandboxCdkExecutionPolicy`. Trust requires both the exact STS
audience and this exact subject:

```text
repo:KyLamportLogic/aws-career-sandbox:environment:aws-career-sandbox
```

The deploy role can assume only the four standard `hnb659fds` CDK bootstrap
roles. The custom CloudFormation execution policy allows the resource families
used by the synthesized stacks and explicitly denies running ECS tasks/services,
network construction, load balancers, RDS, ElastiCache, secrets, Bedrock, and
Route 53 mutations.

## CDK stacks

- `BuildlogicPracticeFoundation`: a tagged USD 25 monthly budget, actual and
  forecast notifications, cost anomaly monitor/subscription, and an import of
  the existing GitHub OIDC provider.
- `BuildlogicPracticeCompute`: one immutable scanned ECR repository, one
  seven-day log group, a small Fargate task definition, its narrowly scoped IAM
  roles, and an environment-bound image publisher role.

An ECS task definition is inert metadata. There is no service, `RunTask` call,
cluster, subnet, or route through which it could execute.

## Deployment sequence

1. A human establishes AWS trust and constrains `CDKToolkit` per the runbook.
2. A human manually dispatches the workflow from `main`.
3. The validation job runs without OIDC permission.
4. GitHub pauses the deployment job for environment approval.
5. After approval, the job obtains an OIDC token, records STS identity, diffs,
   deploys, and uploads templates, outputs, stack descriptions, and metadata.

Stopping the workflow, disabling the environment, or deleting the deploy role
is the kill switch. Non-cancelling concurrency prevents overlapping deploys.
