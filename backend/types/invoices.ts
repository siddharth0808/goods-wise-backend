export interface CreateInvoiceRequest {
  fileName: string;
  contentType: string;
  fileSize?: number;
}

export interface LambdaEvent {
  businessId: string;
  invoiceId: string;
}
