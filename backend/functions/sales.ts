import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { getClaims, buildResponse } from "../utils/http";
import { logError } from "../utils/logger";
import { SalesService } from "../services/sales";

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {
    const service = new SalesService();
    const method = event.requestContext.http.method;

    if (method === "POST") {
        const { sub, fullName = '' } = getClaims(event);
        const body = JSON.parse(event.body ?? "{}");
        const result = await service.createSale(sub,fullName, body);
        return result;
    }

    if (method === "GET") {
        const { sub } = getClaims(event);
        const query = event.queryStringParameters ?? {};
        const limit = query.limit ? Number(query.limit) : 10;
        const result = await service.getSales(sub, limit, query?.nextToken);
        return result;
    }

    return buildResponse(405, { message: "Method not allowed" });
    } catch (error) {
        logError("salesHandler", "Error processing sales request", error);
        return buildResponse(500, { message: "Internal server error" });
    }
};