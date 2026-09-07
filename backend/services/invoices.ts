import { getExtension } from "../utils/common";
import { dynamoDBService } from "../shared/ddb.service";
import { s3Service } from "../shared/s3Bucket.service";
import { lambdaService } from "../shared/lambda.service";
import {
  ExistingProduct,
  ExtractedInvoice,
  ExtractedInvoiceItem,
} from "../types/invoicesProcesser";
import { randomUUID } from "crypto";

import {
  BUSINESS_TABLE,
  INVOICES_TABLE,
  INVOICE_BUCKET,
  INVOICES_PROCESSER_FUNCTION_NAME,
  PRODUCTS_TABLE,
  ALLOWED_TYPES,
  MAX_FILE_SIZE,
} from "../constants";
import { CreateInvoiceRequest, LambdaEvent } from "../types/invoices";
import { getErrorMessage, logError, logInfo } from "../utils/logger";
import { buildResponse } from "../utils/http";
import { APIGatewayProxyResultV2 } from "aws-lambda";

export class UploadInvoiceService {
  constructor(
    public readonly ddbService = dynamoDBService,
    public readonly s3 = s3Service,
    public readonly lambda = lambdaService,
  ) {}

  async validatedUploadInvoiceReq(
    sub: string,
    businessId: string,
    fileName: string,
    contentType: string,
    fileSize: number | undefined,
  ) {
    if (!sub || !businessId) {
      throw Error("Unauthorized");
    }

    if (!fileName || !contentType) {
      throw Error("fileName and contentType are required");
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      throw Error("Only PDF, JPEG and PNG files are supported");
    }

    if (fileSize !== undefined && fileSize > MAX_FILE_SIZE) {
      throw Error("File size cannot exceed 10 MB");
    }

    return { fileName, contentType, fileSize, businessId };
  }

  public async uploadInvoice(payload: CreateInvoiceRequest, sub: string): Promise<APIGatewayProxyResultV2>  {
    try {
      const { fileName, contentType, fileSize }: CreateInvoiceRequest = payload;

      const business = await this.ddbService.getBusinessByOwnerId(
        BUSINESS_TABLE,
        sub,
      );

      if (!business) {
        logError("uploadInvoice", "Business not found");
        return buildResponse(404, { message: "Business not found" });
      }

      await this.validatedUploadInvoiceReq(
        sub,
        business.id,
        fileName,
        contentType,
        fileSize,
      );

      const invoiceId = randomUUID();

      const extension = getExtension(fileName, contentType);

      const documentKey = `${sub}/${business.id}/invoices/${invoiceId}/invoice.${extension}`;

      const now = new Date().toISOString();

      const invoice = {
        id: invoiceId,
        businessId: business.id,

        documentKey,

        documentType: contentType === "application/pdf" ? "PDF" : "IMAGE",

        status: "CREATED",

        createdBy: sub,
        createdAt: now,
        updatedAt: now,
      };

      await this.ddbService.putItems(INVOICES_TABLE, invoice);
      const uploadUrl = await this.s3.getUploadPresignedUrl(
        INVOICE_BUCKET,
        documentKey,
        contentType,
      );

      return buildResponse(200, {
        invoiceId,
        status: invoice.status,
        uploadUrl,
        expiresIn: 900,
      });
    } catch (error: unknown) {
      logError("uploadInvoice", "Error uploading invoice", error);
      return buildResponse(500, {
        message: getErrorMessage(error),
      });
    }
  }

  public async updateInvoiceStatus(sub: string, invoiceId: string): Promise<APIGatewayProxyResultV2>  {
    try {
      const business = await this.ddbService.getBusinessByOwnerId(
        BUSINESS_TABLE,
        sub,
      );
      if (!business) {
        logError("updateInvoiceStatus", "Business not found");
        return buildResponse(404, { message: "Business not found" });
      }
      const invoice = await dynamoDBService.getItem(INVOICES_TABLE, {
        businessId: business.id,
        id: invoiceId,
      });

      if (!Object.keys(invoice).length) {
        logError("updateInvoiceStatus", "Invoice not found");
        return buildResponse(404, { message: "Invoice not found" });
      }

      const exists = await this.s3.isObjectAvailable(
        INVOICE_BUCKET,
        invoice.documentKey,
      );

      if (!exists) {
        logError("updateInvoiceStatus", "Object does not exist");
        return buildResponse(404, { message: "Object does not exist" });
      }

      await this.ddbService.updateItems(
        INVOICES_TABLE,
        {
          businessId: invoice.businessId,
          id: invoice.id,
        },
        `SET #status = :status, updatedAt = :updatedAt`,
        {
          "#status": "status",
        },
        {
          ":status": "UPLOADED",
          ":updatedAt": new Date().toISOString(),
        },
      );

      const lambdaEvent: LambdaEvent = {
        businessId: business.id,
        invoiceId,
      };

      await this.lambda.invokeAsync(
        INVOICES_PROCESSER_FUNCTION_NAME,
        lambdaEvent,
      );

      return buildResponse(200, { invoiceId, status: "UPLOADED" });
    } catch (error: unknown) {
      logError("updateInvoiceStatus", "Error updating invoice status", error);
      return buildResponse(500, { message: getErrorMessage(error) });
    }
  }

  public async getInvoiceStatus(sub: string, invoiceId: string): Promise<APIGatewayProxyResultV2>  {
    try {
      const business = await this.ddbService.getBusinessByOwnerId(
        BUSINESS_TABLE,
        sub,
      );
      if (!business) {
        logError("getInvoiceStatus", "Business not found");
        return buildResponse(404, { message: "Business not found" });
      }

      const invoice = await dynamoDBService.getItem(INVOICES_TABLE, {
        businessId: business.id,
        id: invoiceId,
      });

      if (!Object.keys(invoice).length) {
        logError("getInvoiceStatus", "Invoice not found");
        return buildResponse(404, { message: "Invoice not found" });
      }

      return buildResponse(200, { invoiceId, status: invoice.status });
    } catch (error: unknown) {
      logError("getInvoiceStatus", "Error getting invoice status", error);
      return buildResponse(500, { message: getErrorMessage(error) });
    }
  }

  public async getInvoiceReview(ownerId: string, invoiceId: string): Promise<APIGatewayProxyResultV2>  {
    try {
      const business = await this.ddbService.getBusinessByOwnerId(
        BUSINESS_TABLE,
        ownerId,
      );
      if (!business) {
        logError("getInvoiceReview", "Business not found");
        return buildResponse(404, { message: "Business not found" });
      }

      const invoice = await dynamoDBService.getItem(INVOICES_TABLE, {
        businessId: business.id,
        id: invoiceId,
      });

      if (!Object.keys(invoice).length) {
        logError("getInvoiceReview", "Invoice not found");
        return buildResponse(404, { message: "Invoice not found" });
      }

      let invoiceProducts: ExtractedInvoiceItem[] = [];

      try {
        invoiceProducts = invoice?.products ? JSON.parse(invoice.products) : [];
      } catch (error: unknown) {
        logError("getInvoiceReview", "Error parsing invoice products", error);
        return buildResponse(500, {
          message: "Error parsing invoice products",
        });
      }

      logInfo(
        "getInvoiceReview",
        "invoiceProducts",
        JSON.stringify(invoiceProducts),
      );

      const productNames = invoiceProducts.map(
        (product: ExtractedInvoiceItem) => product.name,
      );

      logInfo(
        "getInvoiceReview",
        "invoice productNames",
        JSON.stringify(productNames),
      );

      const existingProducts = await Promise.all(
        productNames.map((name) =>
          this.ddbService.getItemsByIndex(
            PRODUCTS_TABLE,
            "byProductName",
            "businessId = :businessId AND #name = :name",
            {
              "#name": "name",
            },
            {
              ":businessId": business.id,
              ":name": name,
            },
          ),
        ),
      );

      logInfo(
        "getInvoiceReview",
        "existingProducts",
        JSON.stringify(existingProducts),
      );

      let flatedExisitngProducts: ExistingProduct[] = [];
      existingProducts.forEach((item) => {
        flatedExisitngProducts = [
          ...flatedExisitngProducts,
          ...(item as ExistingProduct[]),
        ];
      });

      logInfo(
        "getInvoiceReview",
        "flatedExisitngProducts",
        JSON.stringify(flatedExisitngProducts),
      );

      let products: Array<ExtractedInvoiceItem & {
        id: string;
        status: string;
        currentQuantity: number;
      }> = [];
      if (!flatedExisitngProducts.length) {
        products = invoiceProducts.map((product: ExtractedInvoiceItem) => {
          return {
            ...product,
            id: randomUUID(),
            status: "NEW",
            currentQuantity: 0,
          };
        });
      } else {
        products = invoiceProducts.map((product: ExtractedInvoiceItem) => {
          const existingProduct = flatedExisitngProducts.find(
            (e: ExistingProduct) => e.name === product.name,
          );

          logInfo("getInvoiceReview", "existingProduct", existingProduct);

          return existingProduct?.id
            ? {
                ...product,
                id: existingProduct?.id,
                status: "EXISTING",
                currentQuantity: existingProduct.currentStock ?? 0,
                amount: Number(existingProduct.amount) + Number(product.amount),
                expiryDate: product.expiryDate
                  ? product.expiryDate
                  : existingProduct.expiryDate,
              }
            : {
                ...product,
                id: randomUUID(),
                status: "NEW",
                currentQuantity: 0,
              };
        });
      }

      return buildResponse(200, {
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        products,
        supplier: invoice.supplier,
        total: invoice.total,
      } as ExtractedInvoice);

    } catch (error: unknown) {
      logError(
        "getInvoiceReview",
        "Error occurred while reviewing invoice",
        error,
      );
      return buildResponse(500, { message: getErrorMessage(error) });
    }
  }
}
