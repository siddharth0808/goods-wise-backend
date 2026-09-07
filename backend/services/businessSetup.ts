import { randomUUID } from "crypto";
import { APIGatewayProxyResultV2 } from "aws-lambda/trigger/api-gateway-proxy";

import { Business, UpdateBusinessRequest } from "../types/business";
import { dynamoDBService } from "../shared/ddb.service";
import { BUSINESS_TABLE } from "../constants";
import { buildResponse } from "../utils/http";
import { getErrorMessage, logError } from "../utils/logger";
import { CreateBusinessRequest } from "../types/business";

export class BusinessService {
  constructor(private readonly ddbService = dynamoDBService) {}

  public async setUpBusiness(ownerId: string, payload: CreateBusinessRequest): Promise<APIGatewayProxyResultV2>  {
    try {
      const business: Business = {
        id: randomUUID(),
        ownerId,
        businessName: payload.name,
        ownerName: payload.ownerName,
        email: payload.email,
        businessAddress: payload.address,
        mobile: payload.phone,
        businessType: payload.businessType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.ddbService.putItems(BUSINESS_TABLE, business);
      return buildResponse(201, business);
    } catch (error: unknown) {
      logError("setUpBusiness", "Error setting up business", error);
      return buildResponse(500, { message:getErrorMessage(error)});
    }
  }

  public async getBusiness(ownerId: string): Promise<APIGatewayProxyResultV2>  {
    try {
      const business = await this.ddbService.getAllItems(
        BUSINESS_TABLE,
        "ownerId = :ownerId",
        { ":ownerId": ownerId },
      );
      return buildResponse(200, business ?? []);
    } catch (error: unknown) {
      logError("getBusiness", "Error fetching business", error);
      return buildResponse(500, { message:getErrorMessage(error)});
    }
  }

  public async updateBusiness(ownerId: string, payload: UpdateBusinessRequest): Promise<APIGatewayProxyResultV2>  {
    try {
      const business = await this.ddbService.getBusinessByOwnerId(
        BUSINESS_TABLE,
        ownerId,
      );
      if (!business) {
        logError("updateBusiness", "Business not found");
        return buildResponse(404, { message: "Business not found" });
      }
      const updateItems = {
        Key: {
          ownerId
        },
        UpdateExpression: `SET businessName = :businessName, email = :email, businessAddress = :businessAddress, mobile = :mobile, updatedAt = :updatedAt`,
        ExpressionAttributeNames: null,
        ExpressionAttributeValues: {
          ":businessName": payload.name,
          ":email": payload.email,
          ":businessAddress": payload.address,
          ":mobile": payload.phone,
          ":updatedAt": new Date().toISOString(),
        },
      };
      const response = await this.ddbService.updateItems(
        BUSINESS_TABLE,
        updateItems.Key,
        updateItems.UpdateExpression,
        updateItems.ExpressionAttributeNames,
        updateItems.ExpressionAttributeValues,
      );
      return buildResponse(201, response);
    } catch (error: unknown) {
      logError("updateBusiness", "Error updating business", error);
      return buildResponse(500, { message:getErrorMessage(error)});
    }
  }
}
