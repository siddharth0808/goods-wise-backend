import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import { ALLOW_ORIGINS, APP_NAME } from "../constant";

export interface ApiStackProps extends StackProps {
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  businessSetupFn: lambdaNode.NodejsFunction;
  productsFn: lambdaNode.NodejsFunction;
  ordersFn: lambdaNode.NodejsFunction;
  transactionsFn: lambdaNode.NodejsFunction;
  invoicesFn: lambdaNode.NodejsFunction;
  salesFn: lambdaNode.NodejsFunction;
  stage?: string;
}

function createIntegration(
  id: string,
  fn: lambdaNode.NodejsFunction,
): HttpLambdaIntegration {
  return new HttpLambdaIntegration(id, fn);
}

function addRoute(
  httpApi: apigwv2.HttpApi,
  path: string,
  methods: apigwv2.HttpMethod[],
  integration: HttpLambdaIntegration,
): void {
  httpApi.addRoutes({ path, methods, integration });
}

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // API Gateway validates the Cognito-issued JWT on every request natively —
    // this is the only "auth" component in the whole stack, and it involves no Lambda.
    const authorizer = new HttpJwtAuthorizer(
      `${APP_NAME}-authorizer-${props.stage}`,
      `https://cognito-idp.${this.region}.amazonaws.com/${props.userPool.userPoolId}`,
      { jwtAudience: [props.userPoolClient.userPoolClientId] },
    );

    const httpApi = new apigwv2.HttpApi(
      this,
      `${APP_NAME}-api-${props.stage}`,
      {
        apiName: `${APP_NAME}-api-${props.stage}`,
        createDefaultStage: false,
        corsPreflight: {
          allowOrigins: ALLOW_ORIGINS, // tighten once the app's origin(s) are known
          allowMethods: [apigwv2.CorsHttpMethod.ANY],
          allowHeaders: ["authorization", "content-type"],
        },
        defaultAuthorizer: authorizer,
      },
    );

    new apigwv2.HttpStage(this, `${APP_NAME}-stage-${props.stage}`, {
      httpApi,
      stageName: props.stage,
      autoDeploy: true,
    });

    const businessSetupIntegration = createIntegration(
      "BusinessSetupIntegration",
      props.businessSetupFn,
    );
    const productsIntegration = createIntegration(
      "ProductsIntegration",
      props.productsFn,
    );
    const ordersIntegration = createIntegration(
      "OrdersIntegration",
      props.ordersFn,
    );
    const transactionsIntegration = createIntegration(
      "transactionsIntegration",
      props.transactionsFn,
    );
    const invoicesIntegration = createIntegration(
      "invoicesIntegration",
      props.invoicesFn,
    );
    const salesIntegration = createIntegration(
      "salesIntegration",
      props.salesFn,
    );

    addRoute(
      httpApi,
      "/business",
      [
        apigwv2.HttpMethod.POST,
        apigwv2.HttpMethod.PATCH,
        apigwv2.HttpMethod.GET,
      ],
      businessSetupIntegration,
    );
    addRoute(
      httpApi,
      "/products",
      [apigwv2.HttpMethod.POST, apigwv2.HttpMethod.GET],
      productsIntegration,
    );
    addRoute(
      httpApi,
      "/products/{id}",
      [apigwv2.HttpMethod.PATCH, apigwv2.HttpMethod.DELETE],
      productsIntegration,
    );
    addRoute(
      httpApi,
      "/products/import",
      [apigwv2.HttpMethod.POST],
      productsIntegration,
    );
    addRoute(
      httpApi,
      "/inventory/{productId}/transactions",
      [apigwv2.HttpMethod.POST, apigwv2.HttpMethod.GET],
      transactionsIntegration,
    );
    addRoute(
      httpApi,
      "/invoices",
      [apigwv2.HttpMethod.POST],
      invoicesIntegration,
    );
    addRoute(
      httpApi,
      "/invoices/{invoiceId}/status",
      [apigwv2.HttpMethod.POST, apigwv2.HttpMethod.GET],
      invoicesIntegration,
    );
    addRoute(
      httpApi,
      "/invoices/{invoiceId}/review",
      [apigwv2.HttpMethod.GET],
      invoicesIntegration,
    );
    addRoute(
      httpApi,
      "/sales",
      [apigwv2.HttpMethod.POST, apigwv2.HttpMethod.GET],
      salesIntegration,
    );

    new CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
  }
}
