import { z } from "zod";

export const extractedInvoiceSupplierSchema = z.object({
  name: z.string().trim().min(1).optional(),
  address: z.string().trim().min(1).optional(),
  gstin: z.string().trim().min(1).optional(),
  contact: z.string().trim().min(1).optional(),

});

export const extractedInvoiceItemSchema = z.object({
  name: z.string().trim().min(1),

  manufacturer: z.string().trim().min(0).optional(),

  batchNumber: z.string().trim().min(0).optional(),
  expiryDate: z.any().optional(),

  hsn: z.string().trim().min(0).optional(),

  quantity: z.number().positive(),

  mrp: z.number().nonnegative().optional(),
  rate: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),

  sgst: z.number().min(0).max(100).optional(),
  cgst: z.number().nonnegative().optional(),

  amount: z.number().nonnegative().optional(),
});

export const extractedInvoiceTotalsSchema = z.object({
  subtotal: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
  grandTotal: z.number().nonnegative().optional(),
});

export const extractedInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1).optional(),

  invoiceDate: z.string().trim().min(1).optional(),

  supplier: extractedInvoiceSupplierSchema.optional(),

  products: z.array(extractedInvoiceItemSchema).min(1),

  total:z.number().nonnegative().optional(),
});

export type ExtractedInvoice = z.infer<
  typeof extractedInvoiceSchema
>;