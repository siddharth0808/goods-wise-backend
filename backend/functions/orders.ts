import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {  buildResponse, getClaims } from '../utils/http';
import { Order, OrderStatus } from '../types/order';
import { ORDERS_TABLE } from '../constants';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Routes: POST /orders, GET /orders/{ownerId}, PATCH /orders/{ownerId}/{orderId}/status
// Mirrors Request.java / OrderModel.java + ViewOrders.java / OrderAdapter.java.
export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;
  const routeKey = event.requestContext.routeKey ?? '';

  if (method === 'POST') {
    const { sub } = getClaims(event);
    const body = JSON.parse(event.body ?? '{}');

    if (!body.ownerId || !body.orders?.length) {
      return buildResponse(400, { message: 'ownerId and a non-empty orders list are required' });
    }

    const total = (body.orders as { price: number; quantity: number }[]).reduce(
      (sum, line) => sum + line.price * line.quantity,
      0
    );

    const order: Order = {
      ownerId: body.ownerId,
      orderId: randomUUID(),
      customerPhone:  sub,
      customerName: body.customerName ?? '',
      total,
      payMode: body.payMode ?? 'COD',
      status: 'PLACED',
      orders: body.orders,
      createdAt: new Date().toISOString(),
    };

    await ddb.send(new PutCommand({ TableName: ORDERS_TABLE, Item: order }));
    return buildResponse(201, order);
  }

  if (method === 'GET') {
    const ownerId = event.pathParameters?.ownerId;
    if (!ownerId) return buildResponse(400, { message: 'ownerId is required' });

    const result = await ddb.send(
      new QueryCommand({
        TableName: ORDERS_TABLE,
        KeyConditionExpression: 'ownerId = :ownerId',
        ExpressionAttributeValues: { ':ownerId': ownerId },
      })
    );
    return buildResponse(200, result.Items ?? []);
  }

  if (method === 'PATCH' && routeKey.includes('/status')) {
    const ownerId = event.pathParameters?.ownerId;
    const orderId = event.pathParameters?.orderId;
    const body = JSON.parse(event.body ?? '{}');
    const status = body.status as OrderStatus;

    if (!ownerId || !orderId) return buildResponse(400, { message: 'ownerId and orderId are required' });
    if (!['PLACED', 'ACCEPTED', 'COMPLETED', 'CANCELLED', 'SHIPPED'].includes(status)) {
      return buildResponse(400, { message: 'status must be PLACED, ACCEPTED, COMPLETED, CANCELLED, or SHIPPED' });
    }

    await ddb.send(
      new UpdateCommand({
        TableName: ORDERS_TABLE,
        Key: { ownerId, orderId },
        UpdateExpression: 'SET #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status },
      })
    );
    return buildResponse(200, { ownerId, orderId, status });
  }

  return buildResponse(405, { message: 'Method not allowed' });
};
