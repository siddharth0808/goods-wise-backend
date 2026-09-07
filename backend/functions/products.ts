import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { buildResponse, getClaims } from "../utils/http";
import { ProductService } from "../services/products";

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
) => {

  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;
  const { sub } = getClaims(event);


  const service = new ProductService();

  // Import products from invoice
  if (method === "POST" && path.includes('/import')) {
    const products = JSON.parse(event.body ?? "[]");
    if(!products.length) return buildResponse(400, 'No products in payload!')
    const importProductRes = await service.importProducts(sub, products);
    return importProductRes;
  }

  // Create a new product
  if (method === "POST") {
    const body = JSON.parse(event.body ?? "{}");
    const required = ["name", "mrp", "rate", "currentStock", "expiryDate"];
    const missing = required.filter((field) => !body[field]);
    if (missing.length) {
      return buildResponse(400, { message: `Missing fields: ${missing.join(", ")}` });
    }
    const createProductRes = await service.createProduct(sub, body);
    return createProductRes;
  }

  // Update an existing product
  if (method === "PATCH") {
    const { id } = event.pathParameters as Record<string, string>;

    const body = JSON.parse(event.body ?? "{}");
    const required = ["name", "mrp", "rate", "expiryDate"];

    const missing = required.filter((field) => !body[field]);
    if (missing.length) {
      return buildResponse(400, { message: `Missing fields: ${missing.join(", ")}` });
    }
    const updateProductRes = await service.updateProduct(sub, id, body);
    return updateProductRes;
  }

  // Delete an existing product
  if (method === "DELETE") {
    const { id } = event.pathParameters as Record<string, string>;
    const deleteProductRes = await service.deleteProduct(sub, id);
    return deleteProductRes;
  }

  // Get all products for a user
  if (method === "GET") {
    const getProductsRes = await service.getProducts(sub);
    return getProductsRes;
  }

  return buildResponse(405, { message: "Method not allowed" });
};
