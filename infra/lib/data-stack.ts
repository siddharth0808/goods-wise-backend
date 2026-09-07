import { Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import { ALLOW_ORIGINS, APP_NAME } from "../constant";

export interface DataStackProps extends StackProps {
  stage?: string;
}

function createTable(
  scope: Construct,
  id: string,
  tableName: string,
  partitionKey: dynamodb.Attribute,
  sortKey?: dynamodb.Attribute,
  stream?: dynamodb.StreamViewType,
): dynamodb.Table {
  return new dynamodb.Table(scope, id, {
    tableName,
    partitionKey,
    ...(sortKey ? { sortKey } : {}),
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.RETAIN,
    ...(stream ? { stream } : {}),
  });
}

export class DataStack extends Stack {
  public readonly businessTable: dynamodb.Table;
  public readonly productsTable: dynamodb.Table;
  public readonly ordersTable: dynamodb.Table;
  public readonly transactionsTable: dynamodb.Table;
  public readonly invoicesTable: dynamodb.Table;
  public readonly salesTable: dynamodb.Table;
  public readonly counterTable: dynamodb.Table;

  public readonly inventoryFlowBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    // Businesses — one item per business. PK = ownerId (Cognito sub).
    this.businessTable = createTable(
      this,
      `${APP_NAME}-businessTable-${props.stage}`,
      `${APP_NAME}-business-${props.stage}`,
      { name: "ownerId", type: dynamodb.AttributeType.STRING },
    );

    this.businessTable.addGlobalSecondaryIndex({
      indexName: "byPhone",
      partitionKey: {
        name: "ownerMobile",
        type: dynamodb.AttributeType.STRING,
      },
    });

    this.productsTable = createTable(
      this,
      `${APP_NAME}-productsTable-${props.stage}`,
      `${APP_NAME}-products-${props.stage}`,
      { name: "businessId", type: dynamodb.AttributeType.STRING },
      { name: "id", type: dynamodb.AttributeType.STRING },
    );

    this.productsTable.addGlobalSecondaryIndex({
      indexName: "byProductName",
      partitionKey: {
        name: "businessId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "name",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.transactionsTable = createTable(
      this,
      `${APP_NAME}-transactionsTable-${props.stage}`,
      `${APP_NAME}-transactions-${props.stage}`,
      { name: "productId", type: dynamodb.AttributeType.STRING },
      { name: "id", type: dynamodb.AttributeType.STRING },
    );

    this.invoicesTable = createTable(
      this,
      `${APP_NAME}-invoicesTable-${props.stage}`,
      `${APP_NAME}-invoices-${props.stage}`,
      { name: "businessId", type: dynamodb.AttributeType.STRING },
      { name: "id", type: dynamodb.AttributeType.STRING },
    );

    this.salesTable = createTable(
      this,
      `${APP_NAME}-salesTable-${props.stage}`,
      `${APP_NAME}-sales-${props.stage}`,
      { name: "businessId", type: dynamodb.AttributeType.STRING },
      { name: "sk", type: dynamodb.AttributeType.STRING },
    );

      this.counterTable = createTable(
      this,
      `${APP_NAME}-counterTable-${props.stage}`,
      `${APP_NAME}-counter-${props.stage}`,
      { name: "PK", type: dynamodb.AttributeType.STRING },
      { name: "sk", type: dynamodb.AttributeType.STRING },
    );

    // Orders — PK = ownerId, SK = orderId. GSI lets a customer look up their own orders.
    this.ordersTable = createTable(
      this,
      `${APP_NAME}-ordersTable-${props.stage}`,
      `${APP_NAME}-orders-${props.stage}`,
      { name: "ownerId", type: dynamodb.AttributeType.STRING },
      { name: "orderId", type: dynamodb.AttributeType.STRING },
      dynamodb.StreamViewType.NEW_IMAGE,
    );

    this.ordersTable.addGlobalSecondaryIndex({
      indexName: "byCustomerPhone",
      partitionKey: {
        name: "customerPhone",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: "orderId", type: dynamodb.AttributeType.STRING },
    });

    this.inventoryFlowBucket = new s3.Bucket(
      this,
      `${APP_NAME}-${props.stage}`,
      {
        bucketName: `${APP_NAME}-${props.stage}`, // let CDK generate a unique name
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
        versioned: true,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        cors: [
          {
            allowedHeaders: ["*"],
            allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.HEAD],
            allowedOrigins: ALLOW_ORIGINS,
            exposedHeaders: ["ETag"],
            maxAge: 3000,
          },
        ],
      },
    );
  }
}
