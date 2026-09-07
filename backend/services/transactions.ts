import {
  InventoryTransaction,
  UpdateTransactionRequest,
} from "../types/transactions";
import { getTransactionSign } from "../utils/common";
import { randomUUID } from "crypto";
import { dynamoDBService } from "../shared/ddb.service";

import {
  BUSINESS_TABLE,
  PRODUCTS_TABLE,
  TRANSACTIONS_TABLE,
} from "../constants";
import { buildResponse } from "../utils/http";
import { getErrorMessage, logError } from "../utils/logger";
import { APIGatewayProxyResultV2 } from "aws-lambda";

export class TransactionService {
  constructor(private readonly ddbService = dynamoDBService) {}

  public async updateTransaction(
    ownerId: string,
    fullName: string,
    productId: string,
    payload: UpdateTransactionRequest,
  ): Promise<APIGatewayProxyResultV2> {
    try {
      const business = await this.ddbService.getBusinessByOwnerId(
        BUSINESS_TABLE,
        ownerId,
      );

      if (!business) {
        logError("updateTransaction", "Business not found");
        return buildResponse(404, { message: "Business not found" });
      }

      const product = await this.ddbService.getItem(PRODUCTS_TABLE, {
        businessId: business.id,
        id: productId,
      });

      const currentStock = product?.currentStock ?? 0;
      const rate = product?.rate ?? 0;

      const sign = getTransactionSign(payload.type);
      const signedQuantity = sign * Math.abs(Number(payload.quantity) || 0);
      const newStock = Number(currentStock + signedQuantity);
      const newAmount = Number(newStock * rate);

      if (newStock < 0) {
        logError(
          "updateTransaction",
          "Adjustment quantity could not be greater than current stock",
        );
        return buildResponse(400, {
          message: `Adjustment quantity could not be greater than current stock!`,
        });
      }

      const item: InventoryTransaction = {
        ownerId,
        businessId: business.id,
        productId,
        id: randomUUID(),
        type: payload.type,
        quantity: Number(payload.quantity),
        previousStock: Number(currentStock),
        newStock,
        newAmount,
        reason: payload.reason ?? "",
        createdBy: fullName ?? "",
        createdAt: new Date().toISOString(),
      };

      const transactonItems = [
        {
          Update: {
            TableName: PRODUCTS_TABLE,
            Key: {
              businessId: business.id,
              id: productId,
            },
            UpdateExpression:
              "SET currentStock =:currentStock, amount =:amount, updatedAt=:updatedAt",
            ExpressionAttributeValues: {
              ":currentStock": newStock,
              ":amount": newAmount,
              ":updatedAt": new Date().toISOString(),
            },
          },
        },
        {
          Put: { TableName: TRANSACTIONS_TABLE, Item: item },
        },
      ];

      await this.ddbService.transactWriteItems(transactonItems);

      return buildResponse(201, item);
    } catch (error: unknown) {
      logError("updateTransaction", "Error updating transaction", error);
      return buildResponse(500, {
        message:getErrorMessage(error),
      });
    }
  }

  public async getTransactions(
    productId: string,
  ): Promise<APIGatewayProxyResultV2> {
    try {
      const result = await this.ddbService.getAllItems(
        TRANSACTIONS_TABLE,
        "productId = :productId",
        { ":productId": productId },
      );
      return buildResponse(200, result);
    } catch (error: unknown) {
      logError("getTransactions", "Error fetching transactions", error);
      return buildResponse(500, {
        message:getErrorMessage(error),
      });
    }
  }
}
