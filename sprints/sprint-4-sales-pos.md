# InventoryFlow — Sprint 4: Sales / POS

## 1. Sprint Overview

**Sprint:** 4  
**Name:** Sales / POS  
**Goal:** Enable a business owner to create, complete, view, and manage sales while keeping inventory accurate and synchronized with every completed sale.

### Sprint outcome

By the end of Sprint 4, a business owner should be able to:

1. View sales history.
2. Start a new sale.
3. Search and select products.
4. Add multiple products to a sale.
5. Change quantities and remove items.
6. See subtotal, discount, and total.
7. Select a payment method.
8. Confirm and complete a sale.
9. Automatically reduce inventory.
10. Prevent sales when available stock is insufficient.
11. View sale details and sales history.
12. Void/cancel a completed sale if that capability is implemented in this sprint.

---

# 2. Scope

## In Scope

- Sales list
- Create sale / POS cart
- Product search for sales
- Multiple sale items
- Quantity management
- Subtotal calculation
- Basic discount support
- Payment method selection
- Sale confirmation
- Inventory deduction
- Inventory transaction creation
- Insufficient-stock protection
- Sale details
- Sales history
- Pagination
- Duplicate-submission protection
- Basic void/cancel flow
- Responsive desktop/mobile UI

## Out of Scope

Do not implement these as part of Sprint 4 unless explicitly requested later:

- Customer management
- Supplier management
- Purchase orders
- Advanced tax reporting
- Loyalty programs
- Coupons/promotions engine
- Advanced analytics
- AI assistant
- RAG
- AI recommendations
- Advanced refunds/returns workflow
- Accounting integration
- Payment gateway integration

---

# 3. Core Business Flow

```text
Sales
  |
  v
+ New Sale
  |
  v
Search Products
  |
  v
Add Products
  |
  v
Update Quantities
  |
  v
Review Cart
  |
  v
Checkout
  |
  v
Select Payment Method
  |
  v
Confirm Sale
  |
  v
Validate Stock
  |
  v
Atomic Sale + Inventory Update
  |
  +--> Create Sale
  +--> Create Sale Items
  +--> Deduct Product Stock
  +--> Create Inventory Transactions
  |
  v
Sale Completed
```

---

# 4. Important Domain Rules

## 4.1 Business isolation

Every sale belongs to exactly one business.

The backend must derive `businessId` from the authenticated Cognito context/token. The client must not be trusted to provide a different business ID for authorization.

```text
Cognito JWT
   |
   v
userId + businessId
   |
   v
Backend
   |
   v
Business-scoped data
```

## 4.2 Inventory is authoritative

The frontend must never directly update product stock.

```text
Sale
  |
  v
Backend inventory operation
  |
  v
Product.currentStock
```

## 4.3 Sale completion must be atomic

A successful sale must not result in only part of the intended operation being persisted.

Conceptually:

```text
Create Sale
+
Create Sale Items
+
Deduct Stock
+
Create STOCK_OUT inventory transactions
```

must succeed together or the operation should not be reported as completed.

## 4.4 Stock cannot become negative

For every sale item:

```text
requested quantity <= available stock
```

must be enforced by the backend.

Frontend validation is helpful, but backend validation is authoritative.

## 4.5 Duplicate sale protection

If a client retries because of a timeout, the same sale must not be created twice.

Use an idempotency key such as:

```text
clientRequestId / idempotencyKey
```

and persist/check it on the backend.

---

# 5. User Stories

## US-4.1 — View Sales

### User Story

**As a business owner, I want to view my sales history so that I can see the sales made by my business.**

### Acceptance Criteria

- User can open the Sales page.
- Only sales belonging to the authenticated business are returned.
- Display:
  - Sale number
  - Date/time
  - Item count
  - Total quantity
  - Total amount
  - Payment method
  - Status
- Support cursor-based pagination.
- Support loading state.
- Support empty state.
- Support error state.
- Desktop uses a table.
- Mobile uses cards/list.

### API

```http
GET /sales?limit=20&nextToken=<token>
```

### Example response

```json
{
  "items": [
    {
      "id": "sale-001",
      "saleNumber": "SALE-1001",
      "itemCount": 3,
      "totalQuantity": 7,
      "subtotal": 520,
      "discount": 20,
      "totalAmount": 500,
      "paymentMethod": "UPI",
      "status": "COMPLETED",
      "createdAt": "2026-09-03T10:30:00.000Z"
    }
  ],
  "nextToken": "..."
}
```

---

## US-4.2 — Create Sale

### User Story

**As a business owner, I want to start a new sale so that I can sell one or more products to a customer.**

### Acceptance Criteria

- User can click `+ New Sale`.
- New sale starts with an empty cart.
- User can add multiple products.
- User can leave the sale without completing it.
- Empty cart cannot be completed.
- Cart state is clearly visible.

### UI

Desktop should use a POS split layout:

```text
Product Search / Results       Current Sale / Cart
-------------------------      --------------------
Search...                      Product × quantity
Product                        Product × quantity
Product                        Product × quantity
                               --------------------
                               Subtotal
                               Discount
                               Total
                               [Checkout]
```

---

## US-4.3 — Search and Add Products

### User Story

**As a business owner, I want to search for products and add them to the sale so that I can build the cart quickly.**

### Search

Current product model does not require SKU or barcode, so primary search should be based on:

- Product name
- Other currently supported identifiers if available

### Acceptance Criteria

- Search is available on the POS screen.
- Search is case-insensitive.
- Partial product name matching is supported.
- Results show:
  - Product name
  - Brand if available
  - Selling price
  - Available stock
- Out-of-stock products cannot be added.
- Clicking `Add` adds the product to the cart.
- Adding an already-selected product does not create a duplicate cart line.

### Example

```text
Search: maggi

Maggi 70g
₹15
Stock: 100
[ Add ]
```

---

## US-4.4 — Manage Sale Item Quantity

### User Story

**As a business owner, I want to increase, decrease, or directly enter a product quantity so that I can sell the correct number of units.**

### Acceptance Criteria

- Default quantity is `1`.
- User can increment quantity.
- User can decrement quantity.
- User can enter a quantity directly.
- Quantity must be a positive number.
- Requested quantity cannot exceed available stock.
- Cart updates immediately.
- Line total updates immediately.
- User can remove a product from the cart.

### UI example

```text
Maggi 70g
₹15 × 2 = ₹30

[ - ]  2  [ + ]   [Remove]
```

---

## US-4.5 — Calculate Sale Totals

### User Story

**As a business owner, I want the sale total to be calculated automatically so that I do not need to calculate it manually.**

### Calculation

For each line:

```text
lineTotal = unitPrice × quantity
```

Then:

```text
subtotal = sum(lineTotal)
total = subtotal - discount
```

### Acceptance Criteria

- Subtotal is calculated automatically.
- Line totals update when quantity changes.
- Total updates immediately.
- Monetary calculations are handled safely without floating-point surprises.
- Discount cannot make the final total negative.

### Example

```text
Maggi 70g      2 × ₹15  = ₹30
Coke 500ml     1 × ₹40  = ₹40
------------------------------
Subtotal                 ₹70
Discount                  ₹0
Total                    ₹70
```

---

## US-4.6 — Apply Basic Discount

### User Story

**As a business owner, I want to apply a basic discount to a sale so that I can reduce the final amount when needed.**

### Supported types

- Fixed amount
- Percentage

### Acceptance Criteria

- User can choose discount type.
- User can enter discount value.
- Discount is validated.
- Percentage must be between `0` and `100`.
- Fixed discount cannot exceed subtotal.
- Final total cannot be negative.
- Sale stores the final discount amount.

### Example

```text
Subtotal: ₹500
Discount: 10%
Discount Amount: ₹50
Total: ₹450
```

---

## US-4.7 — Select Payment Method

### User Story

**As a business owner, I want to select how the customer paid so that the sale records the payment method.**

### Initial payment methods

```text
CASH
UPI
CARD
OTHER
```

### Acceptance Criteria

- Payment method is required before completion.
- User can select exactly one payment method.
- Selected method is visible during confirmation.
- Saved sale contains the selected method.

No online payment processing is required in this story.

---

## US-4.8 — Checkout and Confirm Sale

### User Story

**As a business owner, I want to review the sale before completing it so that I can confirm the final amount and payment method.**

### Acceptance Criteria

- Checkout displays:
  - Items
  - Quantities
  - Subtotal
  - Discount
  - Total
  - Payment method
- User can go back to edit the cart.
- User can confirm the sale.
- Confirm button cannot be triggered multiple times.
- Confirmation should clearly communicate that inventory will be updated.

### Example

```text
Confirm Sale

3 products
4 total units

Subtotal: ₹520
Discount: ₹20
Total: ₹500
Payment: UPI

[ Cancel ]   [ Confirm Sale ]
```

---

## US-4.9 — Prevent Insufficient Stock

### User Story

**As a business owner, I want the system to prevent selling more units than are available so that inventory never becomes negative.**

### Acceptance Criteria

- Backend checks stock for every sale item.
- Sale cannot complete when stock is insufficient.
- Product stock must remain unchanged when sale fails.
- User receives a clear message.
- Multiple sale items are all validated.

### Example

```text
Available Stock: 5
Requested: 8

Insufficient Stock
Only 5 units are available.
```

### Important

Backend condition/transaction logic is mandatory even if the frontend already checks stock.

---

## US-4.10 — Complete Sale and Update Inventory

### User Story

**As a business owner, I want a completed sale to automatically reduce inventory and record the stock movement so that inventory stays accurate.**

### Acceptance Criteria

For every sale item:

1. Sale is created.
2. Sale item is created.
3. Product stock is reduced.
4. Inventory transaction is created with:
   - Type: `STOCK_OUT` or the system's established sale transaction representation
   - Quantity: sold quantity
5. Operation is atomic.
6. Failed sale does not leave partial records.

### Example

Before:

```text
Maggi stock = 100
```

Sale:

```text
Maggi × 2
```

After:

```text
Maggi stock = 98
```

Inventory transaction:

```json
{
  "type": "STOCK_OUT",
  "quantity": 2,
  "reason": "SALE"
}
```

---

## US-4.11 — Idempotent Sale Creation

### User Story

**As a business owner, I want a sale to be created only once even if the application retries the request so that I am not charged or stocked twice.**

### Acceptance Criteria

- Client sends an idempotency key for sale creation.
- Repeating the same request with the same key returns the original result.
- Stock is deducted only once.
- Sale and transaction records are not duplicated.
- Different idempotency keys represent different sale attempts.

### Suggested request

```json
{
  "idempotencyKey": "client-generated-uuid",
  "items": [
    {
      "productId": "product-123",
      "quantity": 2
    }
  ],
  "discount": 20,
  "paymentMethod": "UPI"
}
```

---

## US-4.12 — View Sale Details

### User Story

**As a business owner, I want to view the complete details of a sale so that I can verify what was sold and how it was paid.**

### Display

- Sale number
- Date/time
- Status
- Payment method
- Products
- Quantity
- Unit price
- Line total
- Subtotal
- Discount
- Total
- Created by

### API

```http
GET /sales/{saleId}
```

### Security

The sale must belong to the authenticated business.

---

## US-4.13 — Sales History Search and Filters

### User Story

**As a business owner, I want to search and filter sales so that I can quickly find a specific sale or time period.**

### Initial filters

```text
All
Today
This Week
This Month
```

Optional date range:

```text
From
To
```

Search by:

- Sale number
- Product name if supported by the chosen backend design

### Acceptance Criteria

- Filters are business-scoped.
- Filters can be combined where supported.
- Pagination continues to work with filters.
- Empty results show an appropriate message.

---

## US-4.14 — Void / Cancel Sale

### User Story

**As a business owner, I want to void a sale so that an incorrectly completed sale can be marked as cancelled and the inventory can be restored correctly.**

### Acceptance Criteria

- Only completed sales can be voided.
- User must explicitly confirm the action.
- Sale status changes to `VOIDED`.
- Inventory is restored through a reverse inventory transaction.
- Original sale record remains available for audit.
- Void operation is idempotent.
- A voided sale cannot be voided again.

### Example

Original:

```text
SALE-1001
Maggi × 2
Stock: 100 → 98
```

After void:

```text
Stock: 98 → 100
```

Create a compensating inventory transaction rather than deleting the original sale.

### Note

If the first production version does not require voiding, this story can be deferred without affecting normal sales creation.

---

# 6. Suggested Data Model

## Sale

```typescript
export type SaleStatus =
  | "COMPLETED"
  | "VOIDED";

export type PaymentMethod =
  | "CASH"
  | "UPI"
  | "CARD"
  | "OTHER";

export interface Sale {
  id: string;
  businessId: string;

  saleNumber: string;

  itemCount: number;
  totalQuantity: number;

  subtotal: number;
  discount: number;
  totalAmount: number;

  paymentMethod: PaymentMethod;
  status: SaleStatus;

  idempotencyKey?: string;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

## Sale Item

```typescript
export interface SaleItem {
  id: string;

  businessId: string;
  saleId: string;
  productId: string;

  productName: string;

  quantity: number;
  unitPrice: number;
  lineTotal: number;

  createdAt: string;
}
```

### Why store `productName` and `unitPrice` on SaleItem?

Sales are historical records. If the product name or price changes later, an old sale should still display what was actually sold at the time of the sale.

---

# 7. DynamoDB Design

For the first version, use separate tables if that matches the existing architecture.

Recommended entities:

```text
Sales
SaleItems
```

## Sales table

Initial access pattern:

```text
PK = businessId
SK = id
```

Recommended additional index/access pattern for chronological listing:

```text
businessId + createdAt
```

The exact GSI should follow the existing Products/Inventory table conventions.

## SaleItems table

Initial access pattern:

```text
PK = saleId
SK = id
```

Include `businessId` on every item for defense-in-depth authorization and future business-level querying.

---

# 8. API Contract

## Sales list

```http
GET /sales
GET /sales?limit=20
GET /sales?limit=20&nextToken=<token>
```

## Sale details

```http
GET /sales/{saleId}
```

## Create sale

```http
POST /sales
```

Example:

```json
{
  "idempotencyKey": "uuid",
  "items": [
    {
      "productId": "product-001",
      "quantity": 2
    },
    {
      "productId": "product-002",
      "quantity": 1
    }
  ],
  "discountType": "FIXED",
  "discountValue": 20,
  "paymentMethod": "UPI"
}
```

Do not accept these from the client as authoritative values:

```text
businessId
saleId
saleNumber
createdAt
unitPrice
lineTotal
subtotal
final inventory stock
```

The backend should derive/validate these values from current product data and the authenticated business.

## Void sale

```http
POST /sales/{saleId}/void
```

---

# 9. Backend Architecture

Use the same layering established in previous sprints:

```text
API Gateway
    |
    v
Lambda Handler
    |
    v
Sale Service
    |
    +----> Sale Repository
    |
    +----> Sale Item Repository
    |
    +----> Inventory Service
              |
              v
          DynamoDB
```

Do not duplicate stock logic inside the Sales Lambda.

Reuse the inventory service/transaction logic from Sprint 2.

---

# 10. Suggested Backend Structure

```text
src/
├── functions/
│   └── sales/
│       ├── listSales.ts
│       ├── getSale.ts
│       ├── createSale.ts
│       └── voidSale.ts
│
├── services/
│   └── sale.service.ts
│
├── repositories/
│   ├── sale.repository.ts
│   └── sale-item.repository.ts
│
├── models/
│   ├── sale.ts
│   └── sale-item.ts
│
├── schemas/
│   └── sale.schema.ts
│
└── utils/
    ├── pagination.ts
    └── idempotency.ts
```

---

# 11. Create Sale Transaction Strategy

The core sale operation should be treated as one business operation.

```text
Create Sale Request
      |
      v
Authenticate
      |
      v
Resolve businessId
      |
      v
Validate request
      |
      v
Load products
      |
      v
Validate ownership
      |
      v
Validate stock
      |
      v
Calculate authoritative prices/totals
      |
      v
Execute atomic write
      |
      +--> Sale
      +--> SaleItems
      +--> Product stock deductions
      +--> Inventory transactions
      |
      v
Return completed sale
```

Do not trust frontend-calculated totals or prices.

The frontend calculations are for UX only. The backend recalculates the authoritative amount.

---

# 12. Handling DynamoDB Transaction Limits

For a small MVP, a single DynamoDB `TransactWriteItems` operation may be enough for a small sale.

However, DynamoDB transactions have item-count/size limits. Do not assume an arbitrarily large sale can always fit into one transaction.

Recommended MVP approach:

- Keep normal sale size reasonably bounded.
- Validate maximum sale item count before starting the transaction.
- Return a clear validation error if the sale exceeds the supported transaction size.
- Revisit the design if real usage demonstrates a need for very large sales.

Do not introduce unnecessary complexity until the product requires it.

---

# 13. Frontend Pages

## Sales List

Desktop:

```text
Sales

[ + New Sale ]

Search sales...

[All] [Today] [This Week] [This Month]

----------------------------------------------------------
Sale       Date       Items   Total   Payment    Status
----------------------------------------------------------
SALE-1001  Sep 03     3       ₹520    UPI        Completed
SALE-1002  Sep 03     1       ₹120    Cash       Completed
```

Mobile:

Use cards.

## New Sale / POS

Desktop:

```text
-----------------------------------------------------------
| Search Products                     | Current Sale      |
|                                     |                  |
| [ Search... ]                       | Maggi × 2        |
|                                     | Coke × 1         |
| Product cards/results               |                  |
|                                     | Subtotal ₹70     |
|                                     | Discount ₹0      |
|                                     | Total ₹70        |
|                                     |                  |
|                                     | [ Checkout ]     |
-----------------------------------------------------------
```

## Checkout

Show a focused summary and payment selector.

## Sale Details

Show full historical transaction information.

---

# 14. Loading / Empty / Error States

## Sales list empty

```text
No sales yet

Completed sales will appear here.

[ + New Sale ]
```

## Empty cart

```text
Your cart is empty

Search for a product to start a sale.
```

## Product search empty

```text
No products found

Try another product name.
```

## Insufficient stock

```text
Insufficient stock

Only 5 units of Maggi 70g are available.
```

## Sale failure

```text
Unable to complete sale

Your inventory was not changed. Please try again.
```

---

# 15. Performance Requirements

- Paginate Sales list.
- Do not scan the entire sales table.
- Do not load all products into the browser unnecessarily.
- Product search should query only what is needed.
- Avoid querying all SaleItems for the Sales list.
- Store `itemCount` and `totalQuantity` on Sale for list rendering.
- Reuse cursor pagination utilities from Products/Inventory.

---

# 16. Security Requirements

- All Sales APIs require authentication.
- Every request is resolved to a `businessId` using the authenticated identity.
- A user cannot access another business's sale using a different `saleId`.
- A user cannot sell a product belonging to another business.
- Frontend-provided prices are not trusted.
- Frontend-provided totals are not trusted.
- Frontend-provided business ownership is not trusted.
- Inventory permissions are applied through the backend.

---

# 17. Testing Requirements

## Unit tests

Test:

- Sale total calculation
- Discount calculation
- Payment validation
- Quantity validation
- Insufficient stock validation
- Business ownership validation
- Idempotency logic
- Void logic

## Integration tests

Test:

```text
Create sale
  |
  +--> Sale created
  +--> Sale items created
  +--> Stock reduced
  +--> Inventory transactions created
```

Test failure scenarios:

```text
Insufficient stock
Invalid product
Wrong business
Duplicate request
DynamoDB transaction failure
```

## E2E test

```text
Login
  ↓
Inventory
  ↓
Sales
  ↓
New Sale
  ↓
Search Product
  ↓
Add Product
  ↓
Set Quantity
  ↓
Checkout
  ↓
Payment Method
  ↓
Confirm
  ↓
Success
  ↓
Verify Inventory Decreased
  ↓
Verify Sale Appears in History
```

---

# 18. Definition of Done

Sprint 4 is complete when:

### Backend

- [ ] Sales table deployed.
- [ ] SaleItems table deployed.
- [ ] `GET /sales` implemented.
- [ ] Cursor pagination implemented.
- [ ] `GET /sales/{saleId}` implemented.
- [ ] `POST /sales` implemented.
- [ ] Stock validation implemented.
- [ ] Inventory deduction integrated with existing inventory service.
- [ ] Inventory transaction created for every sold item.
- [ ] Atomic sale operation implemented.
- [ ] Idempotency implemented.
- [ ] Business isolation verified.
- [ ] Unit/integration tests passing.

### Frontend

- [ ] Sales list implemented.
- [ ] New Sale/POS screen implemented.
- [ ] Product search implemented.
- [ ] Add/remove cart items implemented.
- [ ] Quantity editing implemented.
- [ ] Totals implemented.
- [ ] Discount implemented if included in the release.
- [ ] Payment method selection implemented.
- [ ] Checkout implemented.
- [ ] Confirmation implemented.
- [ ] Success state implemented.
- [ ] Sale details implemented.
- [ ] Responsive desktop/mobile layouts implemented.
- [ ] Loading, empty, and error states implemented.

---

# 19. Recommended Implementation Order

Implement in this order:

```text
US-4.1  View Sales
   ↓
US-4.2  Create Sale foundation
   ↓
US-4.3  Search/Add Products
   ↓
US-4.4  Quantity Management
   ↓
US-4.5  Calculate Totals
   ↓
US-4.6  Discount
   ↓
US-4.7  Payment Method
   ↓
US-4.8  Checkout/Confirmation
   ↓
US-4.9  Stock Validation
   ↓
US-4.10 Atomic Sale + Inventory
   ↓
US-4.11 Idempotency
   ↓
US-4.12 Sale Details
   ↓
US-4.13 Search/Filters
   ↓
US-4.14 Void Sale (optional for initial release)
```

---

# 20. Sprint 4 Backlog Summary

| ID | User Story | Priority | Status |
|---|---|---|---|
| US-4.1 | View Sales | High | Planned |
| US-4.2 | Create Sale | Critical | Planned |
| US-4.3 | Search/Add Products | Critical | Planned |
| US-4.4 | Manage Sale Item Quantity | Critical | Planned |
| US-4.5 | Calculate Sale Totals | Critical | Planned |
| US-4.6 | Apply Basic Discount | Medium | Planned |
| US-4.7 | Select Payment Method | High | Planned |
| US-4.8 | Checkout and Confirm Sale | Critical | Planned |
| US-4.9 | Prevent Insufficient Stock | Critical | Planned |
| US-4.10 | Complete Sale + Update Inventory | Critical | Planned |
| US-4.11 | Idempotent Sale Creation | Critical | Planned |
| US-4.12 | View Sale Details | High | Planned |
| US-4.13 | Sales History Search/Filters | Medium | Planned |
| US-4.14 | Void/Cancel Sale | Medium | Planned |

---

# 21. Sprint 4 Success Criteria

A business owner should be able to complete this real-world scenario successfully:

```text
Business
  |
  v
Sales
  |
  v
New Sale
  |
  v
Search "Maggi"
  |
  v
Add 2 units
  |
  v
Add Coke 1 unit
  |
  v
Review total
  |
  v
Select UPI
  |
  v
Confirm
  |
  v
Sale completed
  |
  +--> Sale stored
  +--> Sale items stored
  +--> Maggi stock -2
  +--> Coke stock -1
  +--> Inventory transactions stored
  |
  v
Sale appears in Sales history
```

This is the primary end-to-end outcome for Sprint 4.
