import { dynamoDBService } from "../shared/ddb.service";
import { randomUUID } from "crypto";
import { CreateProductRequest, Product } from "../types/products";
import { ExtractedInvoiceItem } from "../types/invoicesProcesser";
import { BUSINESS_TABLE, PRODUCTS_TABLE } from "../constants";
import { getErrorMessage, logError, logInfo } from "../utils/logger";
import { buildResponse } from "../utils/http";
import { APIGatewayProxyResultV2 } from "aws-lambda";
export class ProductService {
  constructor(private readonly ddbService = dynamoDBService) {}

  public async getProducts(ownerId: string): Promise<APIGatewayProxyResultV2> {
    try {
      const business = await this.ddbService.getBusinessByOwnerId(
        BUSINESS_TABLE,
        ownerId,
      );

      if (!business) {
        logError("getProducts", "Business not found");
        return buildResponse(404, { message: "Business not found" });
      }

      const products = await this.ddbService.getAllItems(
        PRODUCTS_TABLE,
        `businessId = :businessId`,
        { ":businessId": business.id },
      );

      return buildResponse(200, products ?? []);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logError("getProducts", message);
      return buildResponse(500, { message });
    }
  }

  public async createProduct(
    ownerId: string,
    payload: Product,
  ): Promise<APIGatewayProxyResultV2> {
    try {
      const business = await this.ddbService.getBusinessByOwnerId(
        BUSINESS_TABLE,
        ownerId,
      );
      if (!business) {
        logError("createProduct", "Business not found");
        return buildResponse(404, { message: "Business not found" });
      }

      const item: CreateProductRequest = {
        id: randomUUID(),
        ownerId,
        businessId: business.id,
        name: payload.name,
        category: business.businessType,
        rate: Number(payload.rate),
        mrp: Number(payload.mrp),
        currentStock: Number(payload.currentStock),
        manufacturer: payload?.manufacturer || "",
        batchNumber: payload?.batchNumber || "",
        hsn: payload?.hsn || "",
        status: payload.status,
        amount: Number(payload?.amount || 0),
        minimumStock: Number(payload?.minimumStock || 0),
        cgst: Number(payload?.cgst || 0),
        sgst: Number(payload?.sgst || 0),
        expiryDate: new Date(payload.expiryDate).valueOf() || 0,
        discount: Number(payload?.discount || 0),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      logInfo("createProduct", "items", JSON.stringify(item));

      await this.ddbService.putItems(PRODUCTS_TABLE, item);

      return buildResponse(201, item);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logError("createProduct", message);
      return buildResponse(500, { message });
    }
  }

  public async updateProduct(
    ownerId: string,
    productId: string,
    payload: Product,
  ): Promise<APIGatewayProxyResultV2> {
    try {
      const {
        name,
        mrp,
        rate,
        currentStock,
        minimumStock,
        expiryDate,
        manufacturer,
        amount,
        discount,
      } = payload;

      const business = await this.ddbService.getBusinessByOwnerId(
        BUSINESS_TABLE,
        ownerId,
      );

      if (!business) {
        logError("updateProduct", "Business not found");
        return buildResponse(404, { message: "Business not found" });
      }

      const updateItems = {
        Key: {
          businessId: business.id,
          id: productId,
        },
        UpdateExpression: `SET #name = :name, mrp = :mrp, rate = :rate, currentStock = :currentStock, minimumStock = :minimumStock, expiryDate = :expiryDate, manufacturer = :manufacturer, amount = :amount, discount = :discount, updatedAt = :updatedAt`,
        ExpressionAttributeNames: {
          "#name": "name",
        },
        ExpressionAttributeValues: {
          ":name": name,
          ":mrp": Number(mrp),
          ":rate": Number(rate),
          ":currentStock": Number(currentStock),
          ":minimumStock": Number(minimumStock),
          ":expiryDate": new Date(expiryDate).valueOf(),
          ":manufacturer": manufacturer,
          ":amount": Number(amount),
          ":discount": Number(discount),
          ":updatedAt": new Date().toISOString(),
        },
      };

      const item = await this.ddbService.updateItems(
        PRODUCTS_TABLE,
        updateItems.Key,
        updateItems.UpdateExpression,
        updateItems.ExpressionAttributeNames,
        updateItems.ExpressionAttributeValues,
      );

      logInfo("updateProduct", "Updated items", JSON.stringify(item));

      return buildResponse(200, { ...item, id: productId });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logError("updateProduct", message);
      return buildResponse(500, { message });
    }
  }

  public async importProducts(
    ownerId: string,
    products: ExtractedInvoiceItem[],
  ): Promise<APIGatewayProxyResultV2> {
    try {
      const business = await this.ddbService.getBusinessByOwnerId(
        BUSINESS_TABLE,
        ownerId,
      );
      if (!business) {
        logError("importProducts", "Business not found");
        return buildResponse(404, { message: "Business not found" });
      }

      const newProducts = products.filter(
        (product: ExtractedInvoiceItem) => product.status === "NEW",
      );

      const existingProducts = products.filter(
        (product: ExtractedInvoiceItem) => product.status === "EXISTING",
      );

      let items: Record<string, unknown>[] = [];

      logInfo("importProducts", "New products", JSON.stringify(newProducts));

      if (newProducts.length) {
        items = newProducts.map((product: ExtractedInvoiceItem) => {
          return {
            id: product.id,
            ownerId,
            businessId: business.id,
            name: product.name,
            category: business.businessType,
            manufacturer: product?.manufacturer || "",
            rate: Number(product.rate || 0),
            mrp: Number(product.mrp || 0),
            batchNumber: product.batchNumber,
            hsn: product?.hsn || "",
            status: product.status,
            amount: Number(product?.amount || 0),
            currentStock: Number(product.quantity || 0),
            minimumStock: Number(product?.minimumStock || 0),
            cgst: Number(product?.cgst || 0),
            sgst: Number(product?.sgst || 0),
            expiryDate: product.expiryDate
              ? new Date(product.expiryDate).valueOf()
              : product.expiryDate,
            discount: Number(product?.discount || 0),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        });

        logInfo("importProducts", "New products items", JSON.stringify(items));

        await this.ddbService.batchWriteItems(PRODUCTS_TABLE, items);
      }
      logInfo(
        "importProducts",
        "Existing products",
        JSON.stringify(existingProducts),
      );

      if (existingProducts.length) {
        const updateItems = existingProducts.map(
          (product: ExtractedInvoiceItem) => {
            return {
              Key: {
                businessId: business.id,
                id: product.id,
              },
              UpdateExpression:
                "SET #status = :status, currentStock = :currentStock, mrp = :mrp, rate = :rate, amount = :amount, updatedAt = :updatedAt",
              ExpressionAttributeNames: {
                "#status": "status",
              },
              ExpressionAttributeValues: {
                ":status": product.status,
                ":currentStock":
                  Number(product.quantity) + Number(product.currentQuantity),
                ":mrp": Number(product.mrp),
                ":rate": Number(product.rate),
                ":amount": Number(product.amount),
                ":updatedAt": new Date().toISOString(),
              },
            };
          },
        );

        await this.ddbService.batchUpdateItems(PRODUCTS_TABLE, updateItems);

        items = [...items, ...existingProducts.map((product) => ({ ...product }))];
      }
      return buildResponse(200, items);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logError("importProducts", message);
      return buildResponse(500, { message });
    }
  }

  public async deleteProduct(
    ownerId: string,
    id: string,
  ): Promise<APIGatewayProxyResultV2> {
    try {
      const business = await this.ddbService.getBusinessByOwnerId(
        BUSINESS_TABLE,
        ownerId,
      );

      if (!business) {
        logError("deleteProduct", "Business not found");
        throw Error("Business not found!");
      }

      const products = await this.ddbService.deleteItem(PRODUCTS_TABLE, {
        businessId: business.id,
        id,
      });

      return buildResponse(200, products);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logError("deleteProduct", message);
      return buildResponse(500, { message });
    }
  }
}
