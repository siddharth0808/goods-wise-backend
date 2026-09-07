import { InvoiceProcesserService } from "../services/invoicesProcesser";
import { LambdaEvent } from "../types/invoices";
import { logError } from "../utils/logger";

export const handler = async (event: LambdaEvent) => {
  try {
    const service = new InvoiceProcesserService();
    await service.execute(event);
  } catch (error: unknown) {
    logError("InvoiceProcesser", "Error processing invoice", error);
  }
};
