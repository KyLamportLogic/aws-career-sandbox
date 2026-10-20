import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ComputeStack } from "../lib/compute-stack";
import { FoundationStack } from "../lib/foundation-stack";

type Assembly = ReturnType<Template["toJSON"]>;
const subject = "repo:KyLamportLogic/aws-career-sandbox:environment:aws-career-sandbox";

function assembly(): Assembly {
  const app = new cdk.App();
  const env = { account: "123456789012", region: "us-east-1" };
  const foundation = new FoundationStack(app, "Foundation", { env });
  return Template.fromStack(new ComputeStack(app, "Compute", {
    env, githubProvider: foundation.githubProvider,
  })).toJSON();
}

function publisher(document: Assembly) {
  const roles = Object.values(document.Resources).filter((resource: any) =>
    resource.Type === "AWS::IAM::Role" &&
    resource.Properties.AssumeRolePolicyDocument.Statement.some((statement: any) => statement.Principal?.Federated),
  ) as any[];
  assert.equal(roles.length, 1, "exactly one federated publisher role");
  return roles[0];
}

function assertExactTrust(document: Assembly): void {
  const role = publisher(document);
  const statements = role.Properties.AssumeRolePolicyDocument.Statement;
  assert.equal(statements.length, 1, "publisher trust must have one grant");
  assert.equal(statements[0].Effect, "Allow");
  assert.equal(statements[0].Action, "sts:AssumeRoleWithWebIdentity");
  assert.deepEqual(statements[0].Condition, { StringEquals: {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
    "token.actions.githubusercontent.com:sub": subject,
  } }, "publisher trust must bind the exact audience/repository/environment");
  assert.equal(role.Properties.MaxSessionDuration, 3600, "publisher session is bounded to one hour");
}

function imageStatements(document: Assembly): any[] {
  return Object.values(document.Resources).filter((resource: any) => resource.Type === "AWS::IAM::Policy")
    .flatMap((resource: any) => resource.Properties.PolicyDocument.Statement)
    .filter((statement: any) => [statement.Action].flat().some((action: string) => action.startsWith("ecr:")));
}

function assertScopedImages(document: Assembly): void {
  const repositories = Object.entries(document.Resources).filter(([, resource]: any) => resource.Type === "AWS::ECR::Repository");
  assert.equal(repositories.length, 1, "one bounded image repository");
  const expected = { "Fn::GetAtt": [repositories[0][0], "Arn"] };
  const statements = imageStatements(document);
  assert.ok(statements.length > 0, "image permissions must be checked");
  for (const statement of statements) {
    if (statement.Resource === "*") {
      assert.deepEqual([statement.Action].flat(), ["ecr:GetAuthorizationToken"], "wildcard ECR resource is token-only");
    } else {
      for (const resource of [statement.Resource].flat()) {
        assert.deepEqual(resource, expected, "image actions must target the single repository");
      }
    }
  }
}

describe("synthesized publisher authorization boundaries", () => {
  it("binds actual synthesized trust and image permissions", () => {
    const document = assembly();
    assertExactTrust(document);
    assertScopedImages(document);
  });

  for (const invalidSubject of ["repo:other-owner/other-repo:environment:aws-career-sandbox", "repo:KyLamportLogic/aws-career-sandbox:*"]) {
    it(`detects an unauthorized subject: ${invalidSubject}`, () => {
      const document = assembly();
      publisher(document).Properties.AssumeRolePolicyDocument.Statement[0].Condition.StringEquals[
        "token.actions.githubusercontent.com:sub"
      ] = invalidSubject;
      assert.throws(() => assertExactTrust(document), /exact audience\/repository\/environment/);
    });
  }

  it("detects a missing audience restriction", () => {
    const document = assembly();
    delete publisher(document).Properties.AssumeRolePolicyDocument.Statement[0].Condition.StringEquals[
      "token.actions.githubusercontent.com:aud"
    ];
    assert.throws(() => assertExactTrust(document), /exact audience\/repository\/environment/);
  });

  it("detects broad image mutation permission", () => {
    const document = assembly();
    const statement = imageStatements(document).find((item: any) => item.Resource !== "*");
    assert.ok(statement);
    statement.Resource = "*";
    assert.throws(() => assertScopedImages(document), /wildcard ECR resource is token-only/);
  });
});
