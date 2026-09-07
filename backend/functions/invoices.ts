import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { buildResponse, getClaims } from "../utils/http";
import { UploadInvoiceService } from "../services/invoices";
import { logError } from "../utils/logger";

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  try {

    const method = event.requestContext.http.method;
    const path = event.requestContext.http.path;
    const { sub } = getClaims(event);

    const service = new UploadInvoiceService();

    // Create a new invoice
    if (method === "POST" && path.includes("/status")) {
      const invoiceId = event.pathParameters?.invoiceId;
      if (!invoiceId) return buildResponse(400, { message: "invoiceId is required" });
      const updateInvoiceStatus = await service.updateInvoiceStatus(sub, invoiceId);
      return updateInvoiceStatus;
    }

    // Get invoice status
    if (method === "GET" && path.includes("/status")) {
      const invoiceId = event.pathParameters?.invoiceId;
      if (!invoiceId) return buildResponse(400, { message: "invoiceId is required" });
      const getInvoiceStatus = await service.getInvoiceStatus(sub, invoiceId);
      return getInvoiceStatus;
    }

    // Get invoice review
    if (method === "GET" && path.includes("/review")) {
      const invoiceId = event.pathParameters?.invoiceId;
      if (!invoiceId) return buildResponse(400, { message: "invoiceId is required" });
      const getInvoiceReview = await service.getInvoiceReview(sub, invoiceId);
      return getInvoiceReview
    }

    // Upload a new invoice
    const body = event.body ? JSON.parse(event.body) : null;
    if (!body) {
      return buildResponse(400, {
        message: "Request body is required",
      });
    }
    const uploadInvoice = await service.uploadInvoice(body, sub);
    return uploadInvoice
  } catch (error) {
    logError("uploadInvoice", "Error uploading invoice", error);
    return buildResponse(500, {
      message: "Failed to create invoice",
    });
  }
};
