export interface InventoryTransaction {
  id: string;
  ownerId: string;
  businessId: string;
  productId: string;

  type: "STOCK_IN" | "STOCK_OUT" | "DAMAGE" | "RETURN" | "ADJUSTMENT";

  quantity: number;

  previousStock: number;
  newStock: number;
  newAmount?:number;
  reason?: string;

  createdBy: string;
  createdAt: string;
}

export const TRANSACTION_TYPE_OPTIONS = [
  { value: "STOCK_IN", label: "Stock In", sign: 1 },
  { value: "STOCK_OUT", label: "Stock Out", sign: -1 },
  { value: "DAMAGE", label: "Damage", sign: -1 },
  { value: "RETURN", label: "Return", sign: 1 },
  { value: "ADJUSTMENT", label: "Adjustment", sign: 1 },
] as const;

export type TransactionType =
  (typeof TRANSACTION_TYPE_OPTIONS)[number]["value"];

export type UpdateTransactionRequest = {
  id: string;
  type: TransactionType;
  quantity: number;
  reason?: string;
};