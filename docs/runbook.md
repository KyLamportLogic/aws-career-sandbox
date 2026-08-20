# Operator runbook

## Preconditions

- Use an operator-controlled AWS Console or CloudShell session. Do not use an
  agent's local AWS credentials.
- Use Node.js 22 for the repository and the pinned CDK CLI from `package-lock.json`.
- Confirm the target is account `723949188045`, region `us-east-1`.

## One-time trust bootstrap

The account already has the GitHub OIDC provider because the original private
stack was deployed before this repository migration. Launch
`BuildlogicCareerSandboxTrust` from `bootstrap/github-oidc.yaml` and set:

```text
ExistingGitHubOidcProviderArn=arn:aws:iam::723949188045:oidc-provider/token.actions.githubusercontent.com
```

In a clean account, leave the parameter blank and the template creates the
provider. Record the trust stack ID and its three outputs.

## Constrain CDKToolkit

The existing `CDKToolkit` was initially bootstrapped with AdministratorAccess.
Re-bootstrap it from an operator-controlled CloudShell checkout using the
repository-pinned CLI and the policy ARN output above:

```bash
npm ci
npx cdk bootstrap aws://723949188045/us-east-1 \
  --cloudformation-execution-policies arn:aws:iam::723949188045:policy/BuildlogicCareerSandboxCdkExecutionPolicy \
  --termination-protection
```

Verify in CloudFormation that `CDKToolkit` termination protection is enabled and
that its CloudFormation execution role no longer has AdministratorAccess.

## GitHub environment

Create `aws-career-sandbox` with these exact settings:

- Required reviewer: `KyPython` (user ID `179089861`)
- Prevent self-review: disabled
- Administrator bypass: disabled
- Deployment branches: protected branches only, with `main` protected
- Environment secrets: none

## First approved deployment

Dispatch **Deploy AWS career sandbox** on `main`. Confirm the deployment job
shows **Waiting for approval**, then approve as `KyPython`. After completion,
download the audit artifact and record the run URL, approver, repository commit,
STS role identity, stack IDs, and timestamps.

## Incident and rollback

Disable the GitHub environment or delete
`BuildlogicCareerSandboxGitHubDeployRole` to stop new deployments. Do not start
the task definition. Use CloudFormation change sets for corrections; do not
delete the existing stacks merely to simplify OIDC ownership.
