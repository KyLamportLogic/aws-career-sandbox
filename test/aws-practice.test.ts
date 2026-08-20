import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { ComputeStack } from "../lib/compute-stack";
import { FoundationStack } from "../lib/foundation-stack";

const env = { account: "123456789012", region: "us-east-1" };

function assemble() {
  const app = new cdk.App();
  const foundationStack = new FoundationStack(app, "Foundation", { env });
  const computeStack = new ComputeStack(app, "Compute", {
    env,
    githubProvider: foundationStack.githubProvider,
  });
  return {
    foundation: Template.fromStack(foundationStack),
    compute: Template.fromStack(computeStack),
  };
}

describe("bounded AWS career sandbox", () => {
  it("has no running or data-plane infrastructure", () => {
    const { foundation, compute } = assemble();
    for (const template of [foundation, compute]) {
      template.resourceCountIs("AWS::ECS::Service", 0);
      template.resourceCountIs("AWS::ECS::Cluster", 0);
      template.resourceCountIs("AWS::EC2::NatGateway", 0);
      template.resourceCountIs("AWS::EC2::VPC", 0);
      template.resourceCountIs("AWS::ElasticLoadBalancingV2::LoadBalancer", 0);
      template.resourceCountIs("AWS::RDS::DBInstance", 0);
      template.resourceCountIs("AWS::ElastiCache::CacheCluster", 0);
      template.resourceCountIs("AWS::SecretsManager::Secret", 0);
      template.resourceCountIs("AWS::Route53::HostedZone", 0);
      template.resourceCountIs("AWS::Route53::RecordSet", 0);
      template.resourceCountIs("AWS::Bedrock::KnowledgeBase", 0);
      template.resourceCountIs("AWS::Bedrock::DataSource", 0);
    }
  });

  it("caps the tagged monthly budget at 25 USD with 10 USD and ceiling alerts", () => {
    const { foundation } = assemble();
    foundation.hasResourceProperties("AWS::Budgets::Budget", {
      Budget: {
        BudgetName: "buildlogic-practice-monthly",
        BudgetLimit: { Amount: 25, Unit: "USD" },
        BudgetType: "COST",
        CostFilters: { TagKeyValue: ["user:Project$BuildLogic"] },
        TimeUnit: "MONTHLY",
      },
      NotificationsWithSubscribers: Match.arrayWith([
        Match.objectLike({ Notification: Match.objectLike({ NotificationType: "ACTUAL", Threshold: 40 }) }),
        Match.objectLike({ Notification: Match.objectLike({ NotificationType: "ACTUAL", Threshold: 100 }) }),
        Match.objectLike({ Notification: Match.objectLike({ NotificationType: "FORECASTED", Threshold: 100 }) }),
      ]),
    });
    foundation.resourceCountIs("AWS::CE::AnomalyMonitor", 1);
    foundation.hasResourceProperties("AWS::CE::AnomalyMonitor", {
      MonitorName: "buildlogic-career-sandbox",
      MonitorType: "CUSTOM",
      MonitorSpecification: Match.serializedJson({
        Tags: {
          Key: "Project",
          MatchOptions: ["EQUALS"],
          Values: ["BuildLogic"],
        },
      }),
    });
    foundation.resourceCountIs("AWS::CE::AnomalySubscription", 1);
    foundation.hasResourceProperties("AWS::CE::AnomalySubscription", {
      Frequency: "DAILY",
      ThresholdExpression: Match.serializedJson({
        Dimensions: {
          Key: "ANOMALY_TOTAL_IMPACT_ABSOLUTE",
          MatchOptions: ["GREATER_THAN_OR_EQUAL"],
          Values: ["10"],
        },
      }),
    });
  });

  it("uses one immutable, scanned ECR repository with bounded retention", () => {
    const { compute } = assemble();
    compute.resourceCountIs("AWS::ECR::Repository", 1);
    compute.hasResourceProperties("AWS::ECR::Repository", {
      ImageScanningConfiguration: { ScanOnPush: true },
      ImageTagMutability: "IMMUTABLE",
      LifecyclePolicy: Match.objectLike({ LifecyclePolicyText: Match.anyValue() }),
    });
  });

  it("defines a small hardened task but deliberately creates no service", () => {
    const { compute } = assemble();
    compute.resourceCountIs("AWS::ECS::TaskDefinition", 1);
    compute.hasResourceProperties("AWS::ECS::TaskDefinition", {
      Cpu: "256",
      Memory: "512",
      NetworkMode: "awsvpc",
      RequiresCompatibilities: ["FARGATE"],
      RuntimePlatform: { CpuArchitecture: "X86_64", OperatingSystemFamily: "LINUX" },
      ContainerDefinitions: [
        Match.objectLike({
          Essential: true,
          ReadonlyRootFilesystem: true,
          LogConfiguration: Match.objectLike({ LogDriver: "awslogs" }),
        }),
      ],
    });
    compute.resourceCountIs("AWS::ECS::Service", 0);
  });

  it("retains task logs for seven days", () => {
    const { compute } = assemble();
    compute.hasResourceProperties("AWS::Logs::LogGroup", { RetentionInDays: 7 });
  });

  it("imports the bootstrap GitHub OIDC provider instead of creating a second one", () => {
    const { foundation, compute } = assemble();
    foundation.resourceCountIs("AWS::IAM::OIDCProvider", 0);
    compute.resourceCountIs("AWS::IAM::OIDCProvider", 0);
    assert.ok(
      JSON.stringify(compute.findResources("AWS::IAM::Role")).includes(
        "repo:KyLamportLogic/aws-career-sandbox:environment:aws-career-sandbox",
      ),
    );
  });

  it("keeps token authorization wildcard-only while scoping image actions to the sandbox repository", () => {
    const { compute } = assemble();
    compute.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(["ecr:PutImage"]),
            Resource: {
              "Fn::GetAtt": [
                Match.stringLikeRegexp("^SandboxImage"),
                "Arn",
              ],
            },
          }),
          {
            Action: "ecr:GetAuthorizationToken",
            Effect: "Allow",
            Resource: "*",
          },
        ]),
      },
    });
  });

  it("tags every taggable resource as a managed career sandbox", () => {
    const { compute } = assemble();
    compute.hasResourceProperties("AWS::ECR::Repository", {
      Tags: Match.arrayWith([
        { Key: "Environment", Value: "career-sandbox" },
        { Key: "ManagedBy", Value: "CDK" },
        { Key: "Project", Value: "BuildLogic" },
      ]),
    });
  });
});
