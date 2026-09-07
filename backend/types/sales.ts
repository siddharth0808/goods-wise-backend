export type SaleStatus = "COMPLETED" | "VOIDED";

export type PaymentMethod =
  | "CASH"
  | "UPI"
  | "CARD"
  | "OTHER";

export interface Sale {
  id: string;
  businessId: string;
  sk: string;
  saleNumber: string;

  items: CreateSaleLineItem[];
  totalUnits: number;

  discount: Discount | null;
  discountAmount: number;
  subTotalAmt: number;
  totalAmt: number;

  paymentMethod: PaymentMethod;
  status: SaleStatus;

  customerInfo?: CustomerDetails | null;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSaleLineItem {
  productId: string;
  productName:string;
  quantity: number;
  rate:number;
  unitPrice:number;
  total:number;
  currentStock: number;
}

export type DiscountType = 'fixed' | 'percentage';

export interface Discount {
  type: DiscountType;
  /** Rupees for "fixed", 0-100 for "percentage". */
  value: number;
}

/** Optional details captured for the customer associated with a sale. */
export interface CustomerDetails {
  name?: string;
  phone?: string;
  email?: string;
}

export interface CreateSaleRequest {
  items: CreateSaleLineItem[];
  discount: Discount | null;
  discountAmount: number;
  subTotalAmt:number;
  totalAmt:number;
  paymentMethod: PaymentMethod;
  customerInfo?: CustomerDetails;

}

