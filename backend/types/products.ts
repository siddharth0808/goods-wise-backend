export type Product = {
  name: string;
  rate: number;
  mrp: number;
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


