import * as cdk from "aws-cdk-lib";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as ce from "aws-cdk-lib/aws-ce";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

const ALERT_EMAIL = "hello@lamportlogic.com";

export class FoundationStack extends cdk.Stack {
  public readonly githubProvider: iam.IOpenIdConnectProvider;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add("Project", "BuildLogic");
    cdk.Tags.of(this).add("Environment", "career-sandbox");
    cdk.Tags.of(this).add("ManagedBy", "CDK");

    new budgets.CfnBudget(this, "MonthlyBudget", {
      budget: {
        budgetName: "buildlogic-practice-monthly",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        costFilters: { TagKeyValue: ["user:Project$BuildLogic"] },
        budgetLimit: { amount: 25, unit: "USD" },
      },
      notificationsWithSubscribers: [
        this.budgetNotification("ACTUAL", 40),
        this.budgetNotification("ACTUAL", 100),
        this.budgetNotification("FORECASTED", 100),
      ],
    });

    const anomalyMonitor = new ce.CfnAnomalyMonitor(this, "CostAnomalyMonitor", {
      monitorName: "buildlogic-career-sandbox",
      monitorType: "CUSTOM",
      monitorSpecification: JSON.stringify({
        Tags: {
          Key: "Project",
          MatchOptions: ["EQUALS"],
          Values: ["BuildLogic"],
        },
      }),
    });

    new ce.CfnAnomalySubscription(this, "CostAnomalySubscription", {
      subscriptionName: "buildlogic-career-sandbox-daily",
      frequency: "DAILY",
      monitorArnList: [anomalyMonitor.attrMonitorArn],
      subscribers: [{ address: ALERT_EMAIL, type: "EMAIL" }],
      thresholdExpression: JSON.stringify({
        Dimensions: {
          Key: "ANOMALY_TOTAL_IMPACT_ABSOLUTE",
          MatchOptions: ["GREATER_THAN_OR_EQUAL"],
          Values: ["10"],
        },
      }),
    });

    // Import the account GitHub OIDC provider created by
    // tools/aws-practice/bootstrap/github-oidc.yaml. AWS allows one provider
    // per URL, so this stack must not create a second.
    this.githubProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      "GitHubOidcReference",
      this.formatArn({
        service: "iam",
        region: "",
        resource: "oidc-provider",
        resourceName: "token.actions.githubusercontent.com",
      }),
    );

    new cdk.CfnOutput(this, "BudgetName", {
      value: "buildlogic-practice-monthly",
    });
  }

  private budgetNotification(
    notificationType: "ACTUAL" | "FORECASTED",
    threshold: number,
  ): budgets.CfnBudget.NotificationWithSubscribersProperty {
    return {
      notification: {
        comparisonOperator: "GREATER_THAN",
        notificationType,
        threshold,
        thresholdType: "PERCENTAGE",
      },
      subscribers: [{ address: ALERT_EMAIL, subscriptionType: "EMAIL" }],
    };
  }
}
