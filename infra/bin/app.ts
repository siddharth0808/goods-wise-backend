#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { AuthStack } from "../lib/auth-stack";
import { DataStack } from "../lib/data-stack";
import { LambdaStack } from "../lib/lambda-stack";
import { ApiStack } from "../lib/api-stack";
import { APP_NAME } from "../constant";

const app = new cdk.App();

const stage = app.node.tryGetContext("stage") ?? "dev";

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
};

if (!env.account) {
  throw new Error(
    "AWS account is not configured. Set CDK_DEFAULT_ACCOUNT or run CDK with a profile that provides account information.",
  );
}

const auth = new AuthStack(app, `${APP_NAME}-auth-${stage}`, { env, stage });
const data = new DataStack(app, `${APP_NAME}-data-${stage}`, { env, stage });

const functions = new LambdaStack(app, `${APP_NAME}-lambda-${stage}`, {
  env,
  stage,
  businessTable: data.businessTable,
  productsTable: data.productsTable,
  ordersTable: data.ordersTable,
  transactionsTable: data.transactionsTable,
  invoicesTable: data.invoicesTable,
  salesTable: data.salesTable,
  counterTable: data.counterTable,
  inventoryFlowBucket: data.inventoryFlowBucket,
});

new ApiStack(app, `${APP_NAME}-api-${stage}`, {
  env,
  stage,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  businessSetupFn: functions.businessSetup,
  productsFn: functions.productsFn,
  ordersFn: functions.ordersFn,
  transactionsFn: functions.transactionsFn,
  invoicesFn: functions.invoicesFn,
  salesFn: functions.salesFn,
});
