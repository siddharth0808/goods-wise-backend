import { APIGatewayProxyResultV2 } from "aws-lambda";
import {
  BUSINESS_TABLE,
  COUNTERS_TABLE,
  PRODUCTS_TABLE,
  SALES_TABLE,
  TRANSACTIONS_TABLE,
} from "../constants";
import { dynamoDBService } from "../shared/ddb.service";
import { buildResponse } from "../utils/http";
import { getErrorMessage, logError, logInfo } from "../utils/logger";
import { decodeNextToken, encodeNextToken } from "../utils/token";
import { CreateSaleRequest, Sale } from "../types/sales";
import { formatSaleNumber, getFinancialYear } from "../utils/common";
import { randomUUID } from "crypto";
export class SalesService {
  constructor(private readonly ddbService = dynamoDBService) {}

  public async createSale(
    ownerId: string,
    ownerName: string,
    payload: CreateSaleRequest,
  ): Promise<APIGatewayProxyResultV2> {
    try {
      const business = await this.ddbService.getBusinessByOwnerId(
        BUSINESS_TABLE,
        ownerId,
      );
      if (!business) {
        logError("createSale", "Business not found");
        return buildResponse(404, { message: "Business not found" });
      }
      const now = new Date().toISOString();

      const financialYear = getFinancialYear();

      // 1. Generate next number
      const sequence = await this.getNextSaleNumber(business.id, financialYear);

      // 2. Format human-readable sale number
      const saleNumber = formatSaleNumber(financialYear, sequence);

      const transactions = [];

      for (const item of payload.items) {
        if (Number(item.currentStock) < Number(item.quantity)) {
          const errorRes = {
            code: "INSUFFICIENT_STOCK",
            message: `Insufficient stock for ${item.name}`,
            details: {
              productId: item.productId,
              requested: Number(item.quantity),
              available: Number(item.currentStock),
            },
          };
          logError("createSale", "INSUFICIANT_STOCK", errorRes);
          return buildResponse(400, errorRes);
        }

        const newStock = Number(item.currentStock) - Number(item.quantity);
        const newAmount = Number(newStock) * Number(item.rate);

        transactions.push({
          Update: {
            TableName: PRODUCTS_TABLE,
            Key: {
              businessId: business.id,
              id: item.productId,
            },
            UpdateExpression:
              "SET currentStock =:currentStock, amount =:amount, updatedAt=:updatedAt",
            ExpressionAttributeValues: {
              ":currentStock": newStock,
              ":amount": newAmount,
              ":updatedAt": now,
            },
          },
        });
      }
      const saleItem: Sale = {
        id: randomUUID(),
        businessId: business.id,
        SK: `${now}#${saleNumber}`,
        saleNumber,
        items: payload.items,
        totalUnits: payload.items.reduce(
          (sum, item) => sum + Number(item.quantity),
          0,
        ),
        discount: payload.discount,
        discountAmount: payload.discountAmount,
        subTotalAmt: payload.subTotalAmt,
        totalAmt: payload.totalAmt,
        paymentMethod: payload.paymentMethod,
        status: "COMPLETED",
        createdBy: ownerName,
        createdAt: now,
        updatedAt: now,
      };

      transactions.push({
        Put: {
          TableName: SALES_TABLE,
          Item: saleItem,
          ConditionExpression: "attribute_not_exists(PK)",
        },
      });

      for (const item of payload.items) {
        const newStock = Number(item.currentStock) - Number(item.quantity);
        const newAmount = Number(newStock) * Number(item.rate);
        transactions.push({
          Put: {
            TableName: TRANSACTIONS_TABLE,
            Item: {
              ownerId,
              businessId: business.id,
              productId: item.productId,
              id: randomUUID(),
              type: "STOCK_OUT",
              quantity: Number(item.quantity),
              previousStock: Number(item.currentStock),
              newStock,
              newAmount,
              reason: `Sale ${saleNumber}`,
              createdBy: ownerName ?? "",
              createdAt: now,
            },
          },
        });
      }
      logInfo("createSale", "transaction", JSON.stringify(transactions));
      await this.ddbService.transactWriteItems(transactions);
      return buildResponse(201, saleItem);
    } catch (error: unknown) {
      logError("createSale", "Error creating sale", error);
      return buildResponse(500, {
        message: getErrorMessage(error),
      });
    }
  }

  public async getSales(
    ownerId: string,
    limit: number,
    nextToken?: string,
  ): Promise<APIGatewayProxyResultV2> {
    try {
      const business = await this.ddbService.getBusinessByOwnerId(
        BUSINESS_TABLE,
        ownerId,
      );
      if (!business) {
        logError("getSales", "Business not found");
        return buildResponse(404, { message: "Business not found" });
      }
      const sales = await this.ddbService.getItemsWithLimit(
        SALES_TABLE,
        "businessId = :businessId",
        { ":businessId": business.id },
        limit,
        nextToken ? decodeNextToken(nextToken) : undefined,
      );
      return buildResponse(200, {
        items: sales.items,
        nextToken: sales.lastEvaluatedKey
          ? encodeNextToken(sales.lastEvaluatedKey)
          : null,
      });
    } catch (error: unknown) {
      logError("getSales", "Error fetching sales", error);
      return buildResponse(500, {
        message: getErrorMessage(error),
      });
    }
  }

  async getNextSaleNumber(
    businessId: string,
    financialYear: string,
  ): Promise<number> {
    const result = await this.ddbService.updateItems(
      COUNTERS_TABLE,
      {
        PK: `BUSINESS#${businessId}`,
        sk: `SALE_COUNTER#${financialYear}`,
      },
      "SET lastNumber = if_not_exists(lastNumber, :zero) + :one",
      null,
      {
        ":zero": 0,
        ":one": 1,
      },
    );

    return result?.lastNumber as number;
  }
}
