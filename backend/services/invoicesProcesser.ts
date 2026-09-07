import { dynamoDBService } from "../shared/ddb.service";
import { extractedInvoiceSchema } from "../schema/invoicesProcesser.schema";
import { textractInvoiceExtractor } from "./textractExtractor";
import { INVOICES_TABLE, INVOICE_BUCKET } from "../constants";
import { logError, logInfo } from "../utils/logger";
import { LambdaEvent } from "../types/invoices";
export class InvoiceProcesserService {
  constructor(
    private readonly ddbService = dynamoDBService,
    public readonly invoiceExtractor = textractInvoiceExtractor,
  ) {}

  public async execute(event: LambdaEvent): Promise<void> {
    try {
      const invoice = await this.ddbService.getItem(INVOICES_TABLE, {
        businessId: event.businessId,
        id: event.invoiceId,
      });

      if (!invoice) {
        logError("InvoiceProcesserService", "Invoice not found", {
          businessId: event.businessId,
          invoiceId: event.invoiceId,
        });
        throw new Error("Invoice not found");
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
          ":status": "PROCESSING",
          ":updatedAt": new Date().toISOString(),
        },
      );

      const extractRes = await this.invoiceExtractor.extract({
        bucket: INVOICE_BUCKET,
        documentKey: invoice.documentKey,
      });

      logInfo("InvoiceProcesserService", "Extracted invoice data", extractRes);

      const validated = extractedInvoiceSchema.parse(extractRes);

      logInfo("InvoiceProcesserService", "Validated invoice data", validated);

      const updateInvoiceExpression = {
        UpdateExpression: `SET #status = :status, #total=:total, invoiceDate=:invoiceDate, invoiceNumber=:invoiceNumber, products=:products, supplier=:supplier,  updatedAt = :updatedAt`,
        ExpressionAttributeNames: {
          "#status": "status",
          "#total": "total",
        },
        ExpressionAttributeValues: {
          ":invoiceDate": validated?.invoiceDate || "",
          ":invoiceNumber": validated.invoiceNumber || "",
          ":products": JSON.stringify(validated.products),
          ":supplier": validated?.supplier || {},
          ":total": validated?.total || 0,
          ":status": "REVIEW",
          ":updatedAt": new Date().toISOString(),
        },
      };

      logInfo(
        "InvoiceProcesserService",
        "Update invoice expression",
        updateInvoiceExpression,
      );

      await this.ddbService.updateItems(
        INVOICES_TABLE,
        {
          businessId: invoice.businessId,
          id: invoice.id,
        },
        updateInvoiceExpression.UpdateExpression,
        updateInvoiceExpression.ExpressionAttributeNames,
        updateInvoiceExpression.ExpressionAttributeValues,
      );
    } catch (error: unknown) {
      logError("InvoiceProcesserService", "Error processing invoice", error);
    }
  }
}
