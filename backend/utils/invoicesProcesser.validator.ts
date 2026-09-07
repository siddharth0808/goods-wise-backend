import { extractedInvoiceSchema } from "../schema/invoicesProcesser.schema";
import {
  type ExtractedInvoice,
} from "../types/invoicesProcesser";

export function validateExtractedInvoice(
  data: unknown,
): ExtractedInvoice {
  return extractedInvoiceSchema.parse(data);
}