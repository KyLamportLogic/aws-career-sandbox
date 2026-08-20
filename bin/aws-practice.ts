#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { ComputeStack } from "../lib/compute-stack";
import { FoundationStack } from "../lib/foundation-stack";

const app = new cdk.App();
const env = {
  account: "723949188045",
  region: "us-east-1",
};

cdk.Tags.of(app).add("Project", "BuildLogic");
cdk.Tags.of(app).add("Environment", "career-sandbox");
cdk.Tags.of(app).add("ManagedBy", "CDK");

const foundation = new FoundationStack(app, "BuildlogicPracticeFoundation", {
  env,
  description: "Bounded AWS career sandbox cost controls and GitHub OIDC trust",
});

const compute = new ComputeStack(app, "BuildlogicPracticeCompute", {
  env,
  githubProvider: foundation.githubProvider,
  description: "Zero-running-task ECS, ECR, IAM, and CloudWatch learning surface",
});
compute.addStackDependency(foundation);

cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
