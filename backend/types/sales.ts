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

export type SaleUnit = "STRIP" | "PIECE";

export interface CreateSaleLineItem {
  productId: string;
  productName:string;
  /** Whether `quantity` is a count of whole strips or loose pieces. */
  saleUnit: SaleUnit;
  /** Pieces per strip for this product, snapshotted at sale time so stock math stays correct even if the product is edited later. */
  unitsPerStrip: number;
  /** Count of `saleUnit` being sold (e.g. 2 pieces, or 1 strip). */
  quantity: number;
  /** Cost rate per strip, same basis as Product.rate (not affected by saleUnit). */
  rate:number;
  /** Actual selling price per `saleUnit` (e.g. MRP/unitsPerStrip, rounded up, when saleUnit is PIECE). */
  unitPrice:number;
  total:number;
  /** Product's current stock in pieces, snapshotted for the insufficient-stock check. */
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

