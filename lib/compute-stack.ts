import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

export interface ComputeStackProps extends cdk.StackProps {
  readonly githubProvider: iam.IOpenIdConnectProvider;
}

export class ComputeStack extends cdk.Stack {
  public readonly sandboxRepo: ecr.Repository;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add("Project", "BuildLogic");
    cdk.Tags.of(this).add("Environment", "career-sandbox");
    cdk.Tags.of(this).add("ManagedBy", "CDK");

    this.sandboxRepo = new ecr.Repository(this, "SandboxImage", {
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      encryption: ecr.RepositoryEncryption.AES_256,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });
    this.sandboxRepo.addLifecycleRule({
      description: "Retain only the five newest career sandbox images",
      maxImageCount: 5,
    });

    const logGroup = new logs.LogGroup(this, "TaskLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDefinition", {
      cpu: 256,
      memoryLimitMiB: 512,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });
    taskDefinition.addContainer("PracticeContainer", {
      image: ecs.ContainerImage.fromRegistry(
        "public.ecr.aws/amazonlinux/amazonlinux:2023",
      ),
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: "practice" }),
      readonlyRootFilesystem: true,
      essential: true,
      command: ["sleep", "infinity"],
    });

    const githubRole = new iam.Role(this, "GitHubImagePublisher", {
      assumedBy: new iam.OpenIdConnectPrincipal(props.githubProvider).withConditions(
        {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            "token.actions.githubusercontent.com:sub":
              "repo:KyLamportLogic/aws-career-sandbox:environment:aws-career-sandbox",
          },
        },
      ),
      description: "GitHub Actions OIDC image publishing for the career sandbox",
      maxSessionDuration: cdk.Duration.hours(1),
    });
    this.sandboxRepo.grantPullPush(githubRole);
    githubRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ecr:GetAuthorizationToken"],
        resources: ["*"],
      }),
    );
    NagSuppressions.addResourceSuppressions(
      githubRole,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "AWS requires ecr:GetAuthorizationToken to use Resource '*'; every repository-scoped image action remains limited to this single career sandbox repository.",
          appliesTo: ["Action::ecr:GetAuthorizationToken", "Resource::*"],
        },
      ],
      true,
    );

    new cdk.CfnOutput(this, "SandboxRepoUri", {
      value: this.sandboxRepo.repositoryUri,
    });
    new cdk.CfnOutput(this, "TaskDefinitionArn", {
      value: taskDefinition.taskDefinitionArn,
    });
    new cdk.CfnOutput(this, "GitHubImagePublisherRoleArn", {
      value: githubRole.roleArn,
    });
  }
}
