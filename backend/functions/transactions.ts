import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import {  buildResponse, getClaims } from "../utils/http";
import { TransactionService } from "../services/transactions";

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
) => {
  const method = event.requestContext.http.method;
  const { sub, fullName ='' } = getClaims(event);
  const { productId } = event.pathParameters ?? {};
  const service = new TransactionService()

  if (!productId) {
    return buildResponse(400, { message: "Missing productId" });
  }

  // Update an existing transaction
  if (method === "POST") {
    const body = JSON.parse(event.body ?? "{}");
    const required = ["quantity", "type"];
    const missing = required.filter((field) => !body[field]);
    if (missing.length) {
      return buildResponse(400, { message: `Missing fields: ${missing.join(", ")}` });
    }

    const updateTransactionRes = await service.updateTransaction(sub, fullName, productId, body)
    return updateTransactionRes;
  }

  // Get all transactions for a user and product
  if (method === "GET") {
    const getTransactionsRes = await service.getTransactions(productId)
    return getTransactionsRes;
  }

  return buildResponse(405, { message: "Method not allowed" });
};
