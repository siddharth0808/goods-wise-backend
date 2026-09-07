import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';

export function buildResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// API Gateway's JWT authorizer already verified the signature/expiry before this
// code ever runs — this just reads the claims it attached to the request.
export function getClaims(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
  return {
    sub: claims.sub as string, // Cognito user id — use this as ownerId / customer id
    fullName: claims.given_name as string | undefined,
    role: (claims['custom:role'] as string | undefined) ?? 'customer',
  };
}
