import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const template = readFileSync(join(root, "bootstrap/github-oidc.yaml"), "utf8");
const workflow = readFileSync(join(root, ".github/workflows/deploy.yml"), "utf8");

describe("GitHub OIDC trust bootstrap", () => {
  it("binds the deploy role to the exact repository, audience, and environment", () => {
    assert.match(template, /RoleName: BuildlogicCareerSandboxGitHubDeployRole/);
    assert.match(template, /"token\.actions\.githubusercontent\.com:aud": sts\.amazonaws\.com/);
    assert.match(template, /"token\.actions\.githubusercontent\.com:sub": "repo:KyLamportLogic\/aws-career-sandbox:environment:aws-career-sandbox"/);
    assert.doesNotMatch(template, /StringLike:/);
    assert.doesNotMatch(template, /repo:KyLamportLogic\/aws-career-sandbox:(pull_request|ref:)/);
  });

  it("supports a clean create and an explicit existing-provider migration", () => {
    assert.match(template, /Type: AWS::IAM::OIDCProvider/);
    assert.match(template, /Condition: CreateGitHubOidcProvider/);
    assert.match(template, /ExistingGitHubOidcProviderArn/);
  });

  it("denies runtime capacity and product infrastructure", () => {
    for (const action of [
      "ecs:CreateService", "ecs:RunTask", "ecs:StartTask", "ec2:CreateVpc",
      "ec2:CreateNatGateway", "elasticloadbalancing:*", "rds:*", "elasticache:*",
      "bedrock:*", "route53:ChangeResourceRecordSets", "secretsmanager:GetSecretValue",
    ]) assert.ok(template.includes(action), `missing deny action ${action}`);
    assert.match(template, /ManagedPolicyName: BuildlogicCareerSandboxCdkExecutionPolicy/);
  });
});

describe("approval-gated deployment workflow", () => {
  it("is manual-only and grants OIDC only to the environment deployment job", () => {
    assert.match(workflow, /on:\n  workflow_dispatch:/);
    assert.doesNotMatch(workflow, /pull_request:|push:/);
    assert.match(workflow, /environment: aws-career-sandbox/);
    assert.equal((workflow.match(/id-token: write/g) ?? []).length, 1);
  });

  it("pins every third-party action to an immutable SHA", () => {
    const uses = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)].map((match) => match[1]);
    assert.ok(uses.length >= 6);
    for (const action of uses) assert.match(action, /@[0-9a-f]{40}$/);
  });

  it("uses a change set, serial deployment, and audit artifacts", () => {
    assert.match(workflow, /cancel-in-progress: false/);
    assert.match(workflow, /cdk diff --all --change-set=true/);
    assert.match(workflow, /cdk deploy --all --require-approval never/);
    assert.match(workflow, /deployment-audit-/);
  });
});
