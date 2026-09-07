export type OrderStatus =
  | "PLACED"
  | "ACCEPTED"
  | "COMPLETED"
  | "CANCELLED"
  | "SHIPPED";

export interface OrderLine {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

export interface Order {
  ownerId: string;
  orderId: string;
  customerPhone: string;
  customerName: string;
  total: number;
  payMode: string;
  status: OrderStatus;
  orders: OrderLine[];
  createdAt: string;
}