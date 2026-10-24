# Payment Flow & Architecture Documentation

This document provides a comprehensive guide to the **Mokushi Payment System**, covering architecture, transaction lifecycles, concurrency safety, fraud hardening, background reconciliation, and API specifications.

---

## 1. Architecture Overview

The payment system is built on **NestJS**, **Prisma ORM (MySQL)**, and **SSLCommerz Payment Gateway**, hardened for enterprise-grade financial integrity.

```
+--------------------------------------------------------------------------------------------------+
|                                      PAYMENT ARCHITECTURE                                       |
+--------------------------------------------------------------------------------------------------+

   [Client Frontend]
         │
         │ 1. POST /api/payments/initiate
         ▼
   [Payments Controller & Service]
         │
         ├─► Validate user & plan configuration
         ├─► Generate unique Transaction ID (MK_<timestamp>_<random>)
         ├─► Create Transaction row (Status: PENDING) in MySQL
         └─► Initialize session with SSLCommerz API
         │
         ▼
   [Returns Gateway URL (GatewayPageURL)]
         │
         │ 2. Customer redirected to SSLCommerz Checkout Page
         ▼
   [SSLCommerz Hosted Payment Page (bKash / Nagad / Cards / NetBanking)]
         │
         ├───────────────────────────────────────────────────────┐
         │                                                       │
         │ (Customer completes payment)                          │ (Parallel Server Webhook)
         ▼                                                       ▼
   3. POST /api/payments/success                           3. POST /api/payments/ipn
      (Browser Form POST redirect)                            (Instant Payment Notification)
         │                                                       │
         └───────────────────────────┬───────────────────────────┘
                                     │
                                     ▼
                   [validateAndFulfillPayment(valId, tranId)]
                                     │
                                     ├─► Server-to-server call: sslcommerz.validate({ val_id })
                                     ├─► Fraud & Integrity Hardening Checks:
                                     │     - status === "VALID" | "VALIDATED"
                                     │     - tran_id === transaction.tranId
                                     │     - store_id === SSLCOMMERZ_STORE_ID
                                     │     - currency === transaction.currency
                                     │     - Math.abs(amount - transaction.amount) <= 1
                                     │
                                     ├─► Atomic DB Conditional Transition ($transaction):
                                     │     UPDATE Transaction SET status = 'SUCCESS', valId = ...
                                     │     WHERE tranId = ? AND status = 'PENDING'
                                     │
                                     ├─► If count === 1 (Winning Process):
                                     │     - Upsert UserPurchase (granting plan entitlement)
                                     │
                                     └─► If count === 0 (Concurrent Duplicate Process):
                                           - Gracefully skip duplicate fulfillment
                                     │
                                     ▼
   4. HTTP 302 Redirect to Frontend:
      `${FRONTEND_URL}/payment-status?status=success&tran_id=${tranId}`
```

---

## 2. Plans & Entitlements

Configured in `src/payments/constants/plans.constant.ts`:

| Plan Enum | Display Name | Price (BDT) | Granted Features |
| :--- | :--- | :---: | :--- |
| `N5` | JLPT N5 | ৳499 | All premium N5 Grammar, Vocabulary, Kanji modules & mock quizzes |
| `N4` | JLPT N4 | ৳699 | All premium N4 Grammar, Vocabulary, Kanji modules & mock quizzes |
| `RAPID_FIRE_N5` | Rapid Fire N5 | ৳299 | All premium JLPT N5 Rapid-Fire vocabulary drills |
| `RAPID_FIRE_N4` | Rapid Fire N4 | ৳399 | All premium JLPT N4 Rapid-Fire vocabulary drills |
| `N5_N4_BUNDLE` | JLPT N5 + N4 Bundle | ৳999 | All premium JLPT N5 and N4 modules & quizzes (without Rapid Fire) |
| `N5_RAPID_FIRE_BUNDLE` | JLPT N5 + Rapid Fire Bundle | ৳699 | All premium JLPT N5 modules and JLPT N5 Rapid-Fire drills |
| `N4_RAPID_FIRE_BUNDLE` | JLPT N4 + Rapid Fire Bundle | ৳899 | All premium JLPT N4 modules and JLPT N4 Rapid-Fire drills |

---

## 3. Financial Integrity & Security Guarantees

### 3.1 Concurrency & Race Condition Defense (TOCTOU)
- **Problem**: When a customer finishes payment, SSLCommerz triggers both the user's browser redirect (`POST /payments/success`) and the asynchronous server webhook (`POST /payments/ipn`) almost simultaneously.
- **Solution**: The transition from `PENDING` to `SUCCESS` is executed using MySQL atomic row-level conditional locking inside a Prisma transaction:
  ```typescript
  const updateResult = await tx.transaction.updateMany({
    where: {
      tranId,
      status: TransactionStatus.PENDING,
    },
    data: {
      status: TransactionStatus.SUCCESS,
      valId,
      paymentMethod,
    },
  });

  if (updateResult.count === 0) {
    // Another concurrent request already transitioned this transaction!
    return { alreadyFulfilled: true };
  }

  // Atomically provision user purchase
  await tx.userPurchase.upsert({ ... });
  ```
  This guarantees that even under high concurrency or network race conditions, **purchases are provisioned strictly once**.

### 3.2 Gateway Response Hardening
Before fulfilling any transaction, the server executes strict validation against the official SSLCommerz Order Validation API response:
1. **Status Verification**: Requires `status === "VALID"` or `"VALIDATED"`.
2. **Transaction ID Match**: Validates `validationResponse.tran_id === transaction.tranId`.
3. **Store ID Protection**: Validates `validationResponse.store_id === process.env.SSLCOMMERZ_STORE_ID` to block cross-merchant token replay.
4. **Currency Check**: Validates `currency_type === transaction.currency` to prevent currency arbitrage exploits.
5. **Amount Verification**: Compares parsed numeric gateway amount with the billed database amount.

### 3.3 Rate Limiting & Abuse Prevention
- Global requests are governed by NestJS `ThrottlerGuard`.
- `POST /payments/initiate`: Protected with `@Throttle({ default: { limit: 5, ttl: 60000 } })` (max 5 initiations/minute) to stop card-testing bots and cart-stuffing attacks.
- Webhook & Callback Endpoints (`/success`, `/fail`, `/cancel`, `/ipn`): Annotated with `@SkipThrottle()` to ensure legitimate gateway callbacks and retries are never blocked with HTTP 429.

### 3.4 Immutable Admin Audit Logging
Every manual admin grant or revocation is recorded in the dedicated `AuditLog` table within the same atomic `$transaction`:
- Captured Fields: `adminId`, `action` (`PURCHASE_MANUALLY_VALIDATED` / `PURCHASE_REVOKED`), `targetId` (user ID), `details` (JSON payload including plan, tranId, reason), and `createdAt`.

---

## 4. Automated Background Reconciliation

Configured using `@nestjs/schedule` (`ScheduleModule`):

### 4.1 Scheduled Cron Job
- **Schedule**: Every 30 minutes (`@Cron(CronExpression.EVERY_30_MINUTES)`).
- **Scope**: Queries transactions with status `PENDING` between 15 minutes and 24 hours old.
- **Logic**:
  1. Queries SSLCommerz transaction query API by `tran_id`.
  2. If gateway reports `VALID`: Automatically completes validation and fulfills the purchase (recovers dropped callbacks without requiring customer support).
  3. If gateway reports `FAILED` or `CANCELLED`: Updates transaction status accordingly.
  4. If transaction is older than 2 hours and was unattempted: Marks the transaction as `FAILED` (cleans up abandoned checkouts).

### 4.2 On-Demand Admin Trigger
Admins can manually invoke the reconciliation worker at any time via:
`POST /api/payments/admin/reconcile`

---

## 5. API Reference

### 5.1 Public / Customer Endpoints

#### `GET /api/payments/plans`
Returns list of available purchase plans and pricing.
- **Auth**: None
- **Response**: Array of `PlanConfig` objects.

#### `POST /api/payments/initiate`
Initiates a payment session with SSLCommerz.
- **Auth**: Bearer JWT (`JwtGuard`)
- **Rate Limit**: 5 requests / minute
- **Body**:
  ```json
  {
    "planType": "N5",
    "cusPhone": "01700000000",
    "cusAddress": "Dhaka, Bangladesh"
  }
  ```
- **Response (201)**:
  ```json
  {
    "gatewayUrl": "https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=...",
    "tranId": "MK_1791637967558_1234",
    "amount": 499,
    "currency": "BDT",
    "planType": "N5"
  }
  ```

#### `GET /api/payments/my-purchases`
Returns all active plans purchased by the authenticated user.
- **Auth**: Bearer JWT (`JwtGuard`)

#### `GET /api/payments/my-transactions`
Returns transaction history for the authenticated user.
- **Auth**: Bearer JWT (`JwtGuard`)

---

### 5.2 Gateway Callbacks & Webhooks

#### `POST /api/payments/success`
SSLCommerz browser redirect endpoint on successful payment.
- Validates transaction, updates status, provisions purchase, and redirects user to:
  `${FRONTEND_URL}/payment-status?status=success&tran_id=${tranId}`

#### `POST /api/payments/fail`
SSLCommerz browser redirect endpoint on failed payment.
- Updates status to `FAILED` and redirects user to:
  `${FRONTEND_URL}/payment-status?status=failed&tran_id=${tranId}`

#### `POST /api/payments/cancel`
SSLCommerz browser redirect endpoint on cancelled payment.
- Updates status to `CANCELLED` and redirects user to:
  `${FRONTEND_URL}/payment-status?status=cancelled&tran_id=${tranId}`

#### `POST /api/payments/ipn`
SSLCommerz Instant Payment Notification (IPN) server-to-server webhook.
- Asynchronously processes payment confirmation or failure.

---

### 5.3 Admin Endpoints (Requires `Role.ADMIN`)

All admin routes require `JwtGuard`, `RolesGuard`, and `@Roles(Role.ADMIN)`.

#### `GET /api/payments/admin/subscriptions`
List subscriptions with pagination and search.
- **Query Params**: `skip`, `take`, `userId`, `planType`, `search` (searches email & fullName).

#### `GET /api/payments/admin/users/:userId/subscriptions`
Detailed subscription profile for a specific user, including access summary (`hasFullAccess`, `hasN5`, `hasN4`, `hasRapidFire`).

#### `GET /api/payments/admin/transactions`
List all payment transactions with filters (`skip`, `take`, `userId`, `status`).

#### `POST /api/payments/admin/validate`
Manually validate or grant a plan purchase for a user.
- **Body**:
  ```json
  {
    "userId": "uuid-here",
    "planType": "N5_N4_BUNDLE",
    "tranId": "optional-existing-tran-id",
    "reason": "VIP grant"
  }
  ```
- **Audit**: Writes `PURCHASE_MANUALLY_VALIDATED` to `AuditLog`.

#### `POST /api/payments/admin/invalidate`
Manually revoke a plan purchase from a user.
- **Body**:
  ```json
  {
    "userId": "uuid-here",
    "planType": "N5_N4_BUNDLE",
    "reason": "Customer refunded"
  }
  ```
- **Audit**: Writes `PURCHASE_REVOKED` to `AuditLog`.

#### `GET /api/payments/admin/audit-logs`
Query immutable audit logs.
- **Query Params**: `skip`, `take`, `adminId`, `targetId`, `action`.

#### `POST /api/payments/admin/reconcile`
Manually triggers the background reconciliation job.
- **Response**:
  ```json
  {
    "checked": 12,
    "fulfilled": 1,
    "expired": 3,
    "failed": 0
  }
  ```

---

## 6. Database Models (`prisma/schema.prisma`)

```prisma
enum PlanType {
  N5
  N4
  RAPID_FIRE_N5
  RAPID_FIRE_N4
  N5_N4_BUNDLE
  N5_RAPID_FIRE_BUNDLE
  N4_RAPID_FIRE_BUNDLE
}

enum TransactionStatus {
  PENDING
  SUCCESS
  FAILED
  CANCELLED
}

model Transaction {
  id            String            @id @default(uuid())
  userId        String
  user          User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  tranId        String            @unique
  valId         String?
  amount        Float
  currency      String            @default("BDT")
  planToBuy     PlanType
  status        TransactionStatus @default(PENDING)
  paymentMethod String?

  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  @@index([userId])
}

model UserPurchase {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  planType    PlanType
  purchasedAt DateTime @default(now())

  @@unique([userId, planType])
  @@index([userId])
}

model AuditLog {
  id        String   @id @default(uuid())
  adminId   String
  action    String
  targetId  String?
  details   Json?
  ipAddress String?
  createdAt DateTime @default(now())

  @@index([adminId])
  @@index([action])
  @@index([targetId])
}
```

---

## 7. Environment Variables Reference

Ensure the following variables are present in your `.env`:

```env
# SSLCommerz Configuration
SSLCOMMERZ_STORE_ID="your_store_id"
SSLCOMMERZ_STORE_PASSWORD="your_store_password"
SSLCOMMERZ_IS_LIVE="false" # "true" for production, "false" for sandbox

# Application URLs
BACKEND_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:5173"

# Database & Cache
DATABASE_URL="mysql://user:password@host:3306/mokushi_db"
REDIS_URL="redis://localhost:6379"
```

---

## 8. Verification & Testing

To run the complete automated test suite:

```bash
# Run payment-specific unit tests
npm test -- src/payments

# Run full project test suite
npm test

# Build production bundle
npm run build
```
