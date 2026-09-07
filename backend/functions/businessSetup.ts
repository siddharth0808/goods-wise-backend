import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { getClaims, buildResponse } from "../utils/http";
import { BusinessService } from "../services/businessSetup";

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {

  const method = event.requestContext.http.method;
  const { sub } = getClaims(event);
  const body = JSON.parse(event.body ?? "{}");

  const service =  new BusinessService();

  //Create a new business
  if (method === "POST") {
    const required = ["name", "ownerName", "email", "address", "phone", "businessType"];
    const missing = required.filter((field) => !body[field]);
    if (missing.length) {
      return buildResponse(400, { message: `Missing fields: ${missing.join(", ")}` });
    }

    const setUpBusinessRes =  await service.setUpBusiness(sub, body);
    return setUpBusinessRes;
  }

  //Update an existing business
  if (method === "PATCH") {
    const required = ["name", "email", "address", "phone"];
    const missing = required.filter((field) => !body[field]);
    if (missing.length) {
      return buildResponse(400, { message: `Missing fields: ${missing.join(", ")}` });
    }
    const updateBusinessRes =  await service.updateBusiness(sub, body)
    return updateBusinessRes;
  }

  //Get an existing business
  if (method === "GET") {
    const getBusinessRes =await service.getBusiness(sub)
    return getBusinessRes;
  }
};
