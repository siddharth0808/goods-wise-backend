/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable preserve-caught-error */
import {
  DynamoDBClient,
  UpdateItemCommandInput,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  BatchWriteCommand,
  BatchWriteCommandInput,
  DeleteCommand,
  TransactWriteCommand,
  NativeAttributeValue,
} from "@aws-sdk/lib-dynamodb";
import { UpdateItem } from "../types/common";
import { MAX_BATCH_SIZE } from "../constants";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export class DynamoDBService {
  constructor() {}

  public async getBusinessByOwnerId(tableName: string, ownerId: string) {
    try {
      const business = await ddb.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            ownerId,
          },
        }),
      );
      return business.Item ? business.Item : {};
    } catch (error: any) {
      throw Error(error.message);
    }
  }

  public async putItems(tableName: string, Item: Record<string, NativeAttributeValue>) {
    try {
      await ddb.send(
        new PutCommand({
          TableName: tableName,
          Item,
          ConditionExpression: "attribute_not_exists(id)",
        }),
      );
    } catch (error: any) {
      throw Error(error.message);
    }
  }

  public async getItem(tableName: string, Key: Record<string, NativeAttributeValue>) {
    try {
      const resposne = await ddb.send(
        new GetCommand({
          TableName: tableName,
          Key,
        }),
      );
      return resposne.Item ? resposne.Item : {};
    } catch (error: any) {
      throw Error(error.message);
    }
  }

  public async deleteItem(tableName: string, Key: Record<string, NativeAttributeValue>) {
    try {
      const resposne = await ddb.send(
        new DeleteCommand({
          TableName: tableName,
          Key,
        }),
      );
      return resposne.Attributes ? resposne.Attributes : {};
    } catch (error: any) {
      throw Error(error.message);
    }
  }

  public async updateItems(
    tableName: string,
    Key: any,
    UpdateExpression: string,
    ExpressionAttributeNames: any,
    ExpressionAttributeValues:any,
  ) {
    try {
      const command: UpdateItemCommandInput = {
        TableName: tableName,
        Key,
        UpdateExpression,
        ...(ExpressionAttributeNames ? { ExpressionAttributeNames } : {}),
        ExpressionAttributeValues,
        ReturnValues: "ALL_NEW",
      };

      const res = await ddb.send(new UpdateCommand(command));
      return res.Attributes;
    } catch (error: any) {
      throw Error(error.message);
    }
  }

  public async getAllItems(
    tableName: string,
    KeyConditionExpression: any,
    ExpressionAttributeValues: any,
  ) {
    try {
      const command = {
        TableName: tableName,
        KeyConditionExpression,
        ExpressionAttributeValues,
      };
      const resposne = await ddb.send(new QueryCommand(command));
      return resposne.Items ? resposne.Items : [];
    } catch (error: any) {
      throw Error(error.message);
    }
  }

  public async getItemsByIndex(
    tableName: string,
    IndexName: string,
    KeyConditionExpression: any,
    ExpressionAttributeNames: any,
    ExpressionAttributeValues: any,
  ) {
    try {
      const command = {
        TableName: tableName,
        IndexName,
        KeyConditionExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
      };
      const resposne = await ddb.send(new QueryCommand(command));
      return resposne.Items ? resposne.Items : [];
    } catch (error: any) {
      throw Error(error.message);
    }
  }

  public async batchWriteItems(tableName: string, items: any): Promise<void> {
    if (!items.length) {
      return;
    }

    for (let i = 0; i < items.length; i += MAX_BATCH_SIZE) {
      const batch = items.slice(i, i + MAX_BATCH_SIZE);

      const requestItems: BatchWriteCommandInput["RequestItems"] = {
        [tableName]: batch.map((item: any) => ({
          PutRequest: {
            Item: item,
          },
        })),
      };

      let unprocessedItems = requestItems;

      do {
        const response = await ddb.send(
          new BatchWriteCommand({
            RequestItems: unprocessedItems,
          }),
        );

        unprocessedItems = response.UnprocessedItems ?? {};
      } while (
        unprocessedItems[tableName] &&
        unprocessedItems[tableName].length > 0
      );
    }
  }

  public async batchUpdateItems(tableName: string, items: UpdateItem[]) {
    const results = await Promise.all(
      items.map((item) =>
        ddb.send(
          new UpdateCommand({
            TableName: tableName,
            Key: item.Key,
            UpdateExpression: item.UpdateExpression,
            ExpressionAttributeValues: item.ExpressionAttributeValues,
            ExpressionAttributeNames: item.ExpressionAttributeNames,
          }),
        ),
      ),
    );

    return results;
  }

  public async transactWriteItems(transactItems: any[]) {
    try {
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: transactItems,
        }),
      );
    } catch (error: any) {
      throw Error(error.message);
    }
  }

  public async getItemsWithLimit(
    tableName: string,
    KeyConditionExpression: any,
    ExpressionAttributeValues: any,
    limit: number,
    lastEvaluatedKey?: Record<string, unknown>,
  ) {
    try {
      const command = {
        TableName: tableName,
        KeyConditionExpression,
        ExpressionAttributeValues,
        Limit: Math.min(limit, 100),
        ScanIndexForward: false,
        ...(lastEvaluatedKey
          ? {
              ExclusiveStartKey: lastEvaluatedKey,
            }
          : {}),
      };
      const result = await ddb.send(new QueryCommand(command));
      return {
        items: result.Items ?? [],
        lastEvaluatedKey: result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw Error(error.message);
    }
  }
}

export const dynamoDBService = new DynamoDBService();
