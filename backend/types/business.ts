export type UpdateBusinessRequest = {
  name: string;
  phone: string;
  email: string;
  address: string;
}

export type CreateBusinessRequest = {
  ownerName:string;
  name: string;
  businessType: string;
  phone: string;
  email: string;
  address: string;
}

export interface Business {
  id: string;
  ownerId: string; // Cognito sub
  businessName: string;
  ownerName: string;
  email: string;
  businessAddress: string;
  mobile: string;
  businessType: string;
  createdAt: string;
  updatedAt: string;
}