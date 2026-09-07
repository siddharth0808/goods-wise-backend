import { Stack, StackProps, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";

import { APP_NAME } from "../constant";

export interface LambdaStackProps extends StackProps {
  businessTable: dynamodb.Table;
  productsTable: dynamodb.Table;
  ordersTable: dynamodb.Table;
  transactionsTable: dynamodb.Table;
  invoicesTable: dynamodb.Table;
  salesTable: dynamodb.Table;
  counterTable: dynamodb.Table,
  inventoryFlowBucket: s3.Bucket;
  stage?: string;
}

type DynamoDbAccess = "read" | "readWrite";
type S3Access = "read" | "put" | "readWrite";

export class LambdaStack extends Stack {
  private readonly stage?: string;
  public readonly businessSetup: lambda.Function;
  public readonly productsFn: lambda.Function;
  public readonly ordersFn: lambda.Function;
  public readonly transactionsFn: lambda.Function;
  public readonly invoicesFn: lambda.Function;
  public readonly invoicesProcesserFn: lambda.Function;
  public readonly salesFn: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);
    this.stage = props.stage;

    this.businessSetup = this.createLambda(
      "businessSetup",
      "../backend/dist/businessSetup",
      { BUSINESS_TABLE: props.businessTable.tableName },
    );
    this.grantDynamoDb(this.businessSetup, props.businessTable, "readWrite");

    this.productsFn = this.createLambda(
      "productsFn",
      "../backend/dist/products",
      {
        PRODUCTS_TABLE: props.productsTable.tableName,
        BUSINESS_TABLE: props.businessTable.tableName,
      },
    );
    this.grantDynamoDb(this.productsFn, props.productsTable, "readWrite");
    this.grantDynamoDb(this.productsFn, props.businessTable, "readWrite");

    this.ordersFn = this.createLambda(
      "ordersFn",
      "../backend/dist/orders",
      { ORDERS_TABLE: props.ordersTable.tableName },
    );
    this.grantDynamoDb(this.ordersFn, props.ordersTable, "readWrite");

    this.transactionsFn = this.createLambda(
      "transactionsFn",
      "../backend/dist/transactions",
      {
        PRODUCTS_TABLE: props.productsTable.tableName,
        TRANSACTIONS_TABLE: props.transactionsTable.tableName,
        BUSINESS_TABLE: props.businessTable.tableName,
      },
    );
    this.grantDynamoDb(this.transactionsFn, props.productsTable, "readWrite");
    this.grantDynamoDb(
      this.transactionsFn,
      props.transactionsTable,
      "readWrite",
    );
    this.grantDynamoDb(this.transactionsFn, props.businessTable, "read");

    this.invoicesProcesserFn = this.createLambda(
      "invoicesProcesserFn",
      "../backend/dist/invoicesProcesser",
      {
        INVOICES_TABLE: props.invoicesTable.tableName,
        INVOICE_BUCKET: props.inventoryFlowBucket.bucketName,
      },
      { timeout: Duration.minutes(15) },
    );
    this.grantDynamoDb(
      this.invoicesProcesserFn,
      props.invoicesTable,
      "readWrite",
    );
    this.grantS3(this.invoicesProcesserFn, props.inventoryFlowBucket, "read");
    this.grantTextract(this.invoicesProcesserFn);

    this.invoicesFn = this.createLambda(
      "invoicesFn",
      "../backend/dist/invoices",
      {
        INVOICES_TABLE: props.invoicesTable.tableName,
        BUSINESS_TABLE: props.businessTable.tableName,
        INVOICE_BUCKET: props.inventoryFlowBucket.bucketName,
        INVOICES_PROCESSER_FUNCTION_NAME:
          this.invoicesProcesserFn.functionName,
        PRODUCTS_TABLE: props.productsTable.tableName,
      },
    );
    this.grantDynamoDb(this.invoicesFn, props.businessTable, "readWrite");
    this.grantDynamoDb(this.invoicesFn, props.invoicesTable, "readWrite");
    this.grantS3(this.invoicesFn, props.inventoryFlowBucket, "readWrite");
    this.grantDynamoDb(this.invoicesFn, props.productsTable, "read");

    this.invoicesProcesserFn.grantInvoke(this.invoicesFn);

    this.salesFn = this.createLambda(
      "salesFn",
      "../backend/dist/sales",
      {
        SALES_TABLE: props.salesTable.tableName,
        BUSINESS_TABLE: props.businessTable.tableName,
        PRODUCTS_TABLE: props.productsTable.tableName,
        COUNTERS_TABLE: props.counterTable.tableName,
        TRANSACTIONS_TABLE: props.transactionsTable.tableName,
      },
    );
    this.grantDynamoDb(this.salesFn, props.salesTable, "readWrite");
    this.grantDynamoDb(this.salesFn, props.productsTable, "readWrite");
    this.grantDynamoDb(this.salesFn, props.transactionsTable, "readWrite");
    this.grantDynamoDb(this.salesFn, props.counterTable, "readWrite");
    this.grantDynamoDb(this.salesFn, props.businessTable, "read");
  }

  private createLambda(
    name: string,
    codePath: string,
    environment: Record<string, string>,
    options: Pick<lambda.FunctionProps, "timeout"> = {},
  ): lambda.Function {
    const functionName = `${APP_NAME}-${name}-${this.stage}`;

    return new lambda.Function(this, functionName, {
      runtime: lambda.Runtime.NODEJS_24_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      ...options,
      functionName,
      code: lambda.Code.fromAsset(codePath),
      handler: "index.handler",
      environment,
    });
  }

  private grantDynamoDb(
    fn: lambda.Function,
    table: dynamodb.Table,
    access: DynamoDbAccess,
  ): void {
    if (access === "readWrite") {
      table.grantReadWriteData(fn);
      return;
    }

    table.grantReadData(fn);
  }

  private grantS3(
    fn: lambda.Function,
    bucket: s3.Bucket,
    access: S3Access,
  ): void {
    if (access === "read" || access === "readWrite") {
      bucket.grantRead(fn);
    }
    if (access === "put" || access === "readWrite") {
      bucket.grantPut(fn);
    }
  }

  private grantTextract(fn: lambda.Function): void {
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["textract:AnalyzeExpense"],
        resources: ["*"],
      }),
    );
  }
}
