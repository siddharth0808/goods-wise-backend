import {
  AnalyzeExpenseCommand,
  LineItemFields,
  TextractClient,
  type AnalyzeExpenseResponse,
  type ExpenseField,
} from "@aws-sdk/client-textract";
import { InvoiceExtractor } from "../types/invoicesProcesser.interface";
import { ExtractedInvoice } from "../types/invoicesProcesser";
import { formatExpiryDate } from "../utils";
export class TextractInvoiceExtractor implements InvoiceExtractor {
  private readonly textract = new TextractClient({});

  async extract({
    bucket,
    documentKey,
  }: {
    bucket: string;
    documentKey: string;
  }): Promise<ExtractedInvoice> {
    const result = await this.textract.send(
      new AnalyzeExpenseCommand({
        Document: {
          S3Object: {
            Bucket: bucket,
            Name: documentKey,
          },
        },
      }),
    );
    return this.normalizeTextractResult(result);
  }

  normalizeTextractResult(response: AnalyzeExpenseResponse): ExtractedInvoice {
    const expenseDocument = response.ExpenseDocuments?.[0];

    if (!expenseDocument) {
      throw new Error("No invoice data detected");
    }

    const summaryFields = expenseDocument.SummaryFields ?? [];
    const invoiceNumber = this.getSummaryValue(
      summaryFields,
      "INVOICE_RECEIPT_ID",
    );

    const invoiceDate = this.getSummaryValue(
      summaryFields,
      "INVOICE_RECEIPT_DATE",
    );

    const supplierName = this.getSummaryValue(summaryFields, "VENDOR_NAME");
    const supplierContact = this.getSummaryValue(summaryFields, "VENDOR_PHONE");

    const supplierAddress = this.getSummaryValue(
      summaryFields,
      "VENDOR_ADDRESS",
    );

    const supplierGstin = this.getSummaryValue(
      summaryFields,
      "VENDOR_GST_NUMBER",
    );

    const total = this.parseNumber(
      this.getSummaryValue(summaryFields, "SUBTOTAL"),
    );

    const items: any = (expenseDocument.LineItemGroups ?? [])
      .flatMap((group) => group.LineItems ?? [])
      .map((group) => this.normalizeLineItem(group))
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      invoiceNumber,
      invoiceDate,

      supplier: {
        name: supplierName,
        address: supplierAddress,
        gstin: supplierGstin,
        contact: supplierContact
      },

      products:items,

      total
    };
  }

  getSummaryValue(fields: ExpenseField[], type: string): string | undefined {
    const field = fields.find((item) => item.Type?.Text === type);

    return field?.ValueDetection?.Text?.trim() || undefined;
  }

  parseNumber(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const normalized = value.replace(/[₹$€£,\s]/g, "").replace(/[^\d.-]/g, "");

    if (!normalized) {
      return undefined;
    }

    const number = Number(normalized);

    return Number.isFinite(number) ? number : undefined;
  }

  normalizeLineItem(group: LineItemFields) {
    const fields = group?.LineItemExpenseFields ?? [];

    let values: Record<string, any> = {};
    const otherValues:any = {};
    for (const field of fields) {
      const type = field.Type?.Text;
      const value = field.ValueDetection?.Text?.trim();
      if (type === "OTHER") {
        const label = field.LabelDetection?.Text?.trim();
        if(label && value){
        otherValues[label.toUpperCase()] = value.includes('\n') ?  value.split('\n')[0] : value
        }
      }
      if (type && type !== "OTHER" && value) {
        values[type] = value.includes('\n') ?  value.split('\n')[0] : value;
      }
    }
    values = { ...values, ...otherValues };
    console.log("Values::::", JSON.stringify(values))
    const productName = values.ITEM || values.PRODUCT || values.DESCRIPTION;
    const pack =  values.PACK || values.PACKAGE || undefined;
    const quantity = this.parseNumber(values.QUANTITY || 0);

    if (!productName || quantity === undefined) {
      return null;
    }

    return {
      name: pack ? `${productName} ${pack}`: productName,

      manufacturer: values.MANUFACTURER ||values.MFR|| values['MFG.'] || values['MFR.'] || null,

      batchNumber: values.BATCH_NUMBER || values.BATCH || values['BATCH NO.'] || values.PRODUCT_CODE || null,

      expiryDate: formatExpiryDate(values.EXPIRY_DATE || values.EXPIRY || values.EXP || values['EXP.'] || null),

      hsn: values.HSN || "0",

      quantity,

      mrp: this.parseNumber(values.MRP || "0"),

      rate: this.parseNumber(values.RATE || values.UNIT_PRICE || "0"),

      discount: this.parseNumber(values.DISCOUNT || values['DISC.'] || "0"),

      sgst: this.parseNumber(values.SGST || "0"),

      cgst: this.parseNumber(values.CGST || "0"),

      amount: this.parseNumber(
        values.AMOUNT || values.LINE_TOTAL || values.PRICE || "0"
      ),
    };
  }
}

export const textractInvoiceExtractor = new TextractInvoiceExtractor();
