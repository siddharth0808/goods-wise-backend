export type Product = {
  name: string;
  rate: number;
  mrp: number;
  /** Pieces per strip/pack as billed by the supplier (e.g. 10 tablets/strip). Defaults to 1 for items already sold loose. */
  unitsPerStrip: number;
  /** Total stock on hand, always expressed in pieces (currentStock = strips * unitsPerStrip). */
  currentStock: number;
  minimumStock: number;
  expiryDate: number;
  manufacturer?: string;
  batchNumber?: string;
  hsn?: string;
  status?: string;
  amount?: number;
  cgst?: number;
  sgst?: number;
  discount?: number;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest extends Product {
  ownerId: string;
  businessId: string;
  id: string;
}


