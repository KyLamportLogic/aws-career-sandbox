# Cloud story

**As of 2026-10-20.** AWS Certified Solutions Architect – Associate (SAA-C03) is the next certification. It is not earned. This file is the public cloud story that can be told before the badge.

## The end, first

Someone opens this repository looking for an AWS engineer. The honest ending is already in the template tests and the deploy policy.

There is one ECS task definition. There is no ECS service, no cluster, and no path that runs the task. A monthly budget alarm and a cost-anomaly monitor exist. A load balancer, VPC, database, cache, secret, DNS change, and Bedrock resource do not. GitHub will not hand this repository cloud credentials until a human approves the protected `aws-career-sandbox` environment. An agent is forbidden to run `cdk bootstrap` or `cdk deploy`.

That is the cloud story this repository can support.

## What the reader is tempted to conclude

A public CDK app, an OIDC deploy role, and the words "career sandbox" can be read as three larger claims:

- SAA-C03 has been earned.
- The account has production workload tenure.
- The CDK, policy, and workflow are unaided personal implementation.

None of those claims is available from this tree.

SAA-C03 stays off every public surface until AWS issues it. A passed exam would still not create production tenure. This repository's own governance contract attributes the sandbox to an AI agent working for `KyPython`. The career record therefore excludes this repository as personal-implementation evidence. Read it as practice infrastructure with a recorded author, not as a résumé line that says "I built our AWS platform."

## What the code actually does

Account `723949188045` and region `us-east-1` are already public portfolio metadata. The trust subject is exact:

```text
repo:KyLamportLogic/aws-career-sandbox:environment:aws-career-sandbox
```

`BuildlogicPracticeFoundation` carries a tagged 25-dollar monthly budget, forecast notifications, and the cost-anomaly monitor, and it imports the existing GitHub OIDC provider. `BuildlogicPracticeCompute` carries one immutable scanned ECR repository, a seven-day log group, one small Fargate task definition, narrow IAM roles, and an environment-bound image publisher role.

The task definition is inert metadata. The execution policy denies running ECS tasks and services, building a network, and creating load balancers, RDS, ElastiCache, secrets, Bedrock, and Route 53 changes. Validation runs with no OIDC token. The deploy job receives a token only after environment approval, assumes `BuildlogicCareerSandboxGitHubDeployRole`, records identity and a change-set diff, and uploads the evidence. Disabling the environment, disabling the workflow, or deleting the role is the kill switch.

The mechanism worth keeping is the refusal. A diagram of compute is not compute. Silence from a cloud API is not success. This sandbox would rather show an unrun task than a task it cannot account for.

## What stays outside this story

A separate private repository, `ky-cloud-control-plane`, is a different system. It is not described here, and it is not SAA evidence.

The next fact that would change the public sentence is an issued SAA-C03 credential. Until that exists, the sentence stays this one: the next certification is SAA-C03, and the public cloud practice is an approval-gated sandbox that does not run a workload.
