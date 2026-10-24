# Mokushi Backend — Developer & Architecture Guide

Welcome to the **Mokushi Backend** codebase. This guide serves as the authoritative context and instruction set for AI agents and software engineers working on this repository.

---

## 1. Project Overview

**Mokushi** is a specialized Japanese language learning platform focusing on JLPT N5 and N4 mastery. The backend is built on **NestJS 11** and TypeScript, providing REST APIs, WebSocket gateways, and background scheduled tasks for quizzes, grammar rules, vocabulary drills, real-time leaderboards, user progression tracking, and digital bundle payments.

### Primary Technologies
- **Framework:** NestJS 11 (Express platform)
- **Language & Runtime:** TypeScript 5.7+ / Node.js
- **ORM & Database:** Prisma ORM 6.7 with MySQL (configurable to PostgreSQL)
- **Authentication:** Passport.js (JWT in HTTP-only cross-site cookies & Bearer fallback, Local strategy, Google OAuth 2.0)
- **Real-Time:** `@nestjs/websockets` with Socket.IO
- **Caching & Rate Limiting:** Redis / In-memory fallback (`CacheService`), `@nestjs/throttler`
- **Payment Processing:** SSLCommerz gateway integration with idempotency, anti-fraud verification, and background reconciliation
- **Documentation:** Auto-generated OpenAPI / Swagger (`/api/docs`)
- **Testing:** Jest, Supertest, ts-jest

---

## 2. Directory Structure & Module Architecture

```text
├── prisma/
│   ├── schema.prisma              # Database models, relations, enums, indexes
│   ├── seed.ts                    # Targeted seed scripts (users, rules, modules, quizzes)
│   └── safe-user.select.ts        # Reusable Prisma select projection omitting passwords
├── src/
│   ├── main.ts                    # Bootstrap: global prefix (/api), CORS, cookies, validation pipe, Swagger
│   ├── app.module.ts              # Root module & global middleware/rate-limiting
│   ├── redis.module.ts            # Redis cache registration
│   ├── auth/                      # Authentication & authorization lifecycle
│   │   ├── decorators/            # @CurrentUser(), @Roles()
│   │   ├── guards/                # JwtGuard, RolesGuard, OptionalJwtGuard, LocalGuard, AdminGuard
│   │   ├── middleware/            # AuthMiddleware (auto-refreshes expired access tokens in-flight)
│   │   ├── strategies/            # JwtStrategy, LocalStrategy, GoogleStrategy
│   │   └── dto/                   # Auth & registration payloads
│   ├── common/                    # Shared utilities, interceptors, and services
│   │   ├── interceptors/          # LoggingInterceptor
│   │   ├── services/              # CacheService (Map-based with regex invalidation & TTL)
│   │   └── utils/                 # cookie.helpers.ts, jwt.helpers.ts, role.helpers.ts
│   ├── database/                  # DatabaseModule & DatabaseService extending PrismaClient
│   ├── leaderboard/               # Real-time WebSocket gateway and categorized ranking calculations
│   ├── lessons/                   # Lessons & lesson-level grammar rules
│   ├── module/                    # JLPT modules (Grammar, Vocabulary, Listening) & quiz configs
│   ├── payments/                  # SSLCommerz payments, purchase entitlements, reconciliation & audit logs
│   ├── questions/                 # Question bank and AI/manual question generation
│   ├── rapid-fire/                # High-speed vocabulary drills, word banks, and daily practice quotas
│   ├── user-attempts/             # Timed quiz attempt sessions, submissions, score normalization & history
│   └── users/                     # User management, role elevation, profile retrieval
└── test/
    ├── app.e2e-spec.ts            # End-to-end integration tests
    └── jest-e2e.json              # E2E test configuration
```

---

## 3. Building, Running, and Development Commands

> **Windows PowerShell Tip:** If PowerShell policy restricts running `.ps1` scripts, invoke npm tools using `npm.cmd` (e.g. `npm.cmd test`, `npx.cmd prisma generate`).

### Setup & Dependencies
```bash
# Install packages
npm install

# Setup environment variables
cp .env.example .env
```

### Database & Prisma
```bash
# Push schema changes to the database
npx prisma db push

# Generate fresh Prisma Client
npx prisma generate

# Validate schema integrity
npx prisma validate

# Seed database with sample data
npm run seed:all          # Seed everything
npm run seed:modules      # Seed JLPT modules
npm run seed:rules        # Seed grammar rules
npm run seed:questions    # Seed question bank
npm run seed:users        # Seed test users
```

### Running the Application
```bash
# Development with hot-reload
npm run start:dev

# Production build
npm run build

# Run production build
npm run start:prod
```

### Testing & Code Quality
```bash
# Run unit test suite
npm test

# Run tests with specific path filter
npm test -- src/payments

# Run end-to-end test suite
npm run test:e2e

# Run tests with coverage
npm run test:cov

# Code formatting and linting
npm run format
npm run lint
```

---

## 4. Key Architectural Patterns & Conventions

### Authentication & Cookie Management
- **HTTP-Only Cross-Site Cookies:** The frontend and backend run on different domains/subdomains (e.g., `dev.mokushiken.com` and the backend VPS API). Therefore, authentication cookies **must always** be set with:
  ```typescript
  sameSite: "none",
  secure: isProduction,
  httpOnly: true,
  path: "/"
  ```
  Always use `setAuthCookies(res, ...)` and `clearAuthCookies(res, ...)` from `src/common/utils/cookie.helpers.ts`. Never hardcode `sameSite: "strict"` or `sameSite: "lax"`, as this immediately locks out cross-site requests.
- **In-Flight Token Auto-Refresh:** `AuthMiddleware` verifies incoming `access_token` cookies. If expired, it rotates the token in the database, sets the new cookie, and mutates `req.cookies.access_token = newAccessToken` and `req.headers.authorization = Bearer ${newAccessToken}` so that downstream `JwtGuard` passes without dropping the current request.
- **User Identifier Convention:** Extract user identity safely using:
  ```typescript
  const userId = user?.id || user?.userId || user?.sub;
  ```

### Cross-Origin Resource Sharing (CORS)
- `src/main.ts` configures dynamic origin validation:
  - Supports `process.env.FRONTEND_URL` and comma-separated `process.env.CORS_ORIGINS`.
  - Normalizes origins by trimming trailing slashes.
  - Automatically matches any subdomain under `*.mokushiken.com` and `localhost` ports.
  - Grants required headers including `Content-Type`, `Authorization`, `X-Requested-With`, `Accept`, and `Origin`.

### Data Validation & DTO Standards
- Global `ValidationPipe` enforces:
  ```typescript
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true
  ```
  Every incoming field on body payloads **must** be explicitly declared on the DTO class using `class-validator` decorators (`@IsString()`, `@IsEnum()`, `@IsOptional()`, etc.).
- When reading enum parameters from queries or params (such as `jlptLevel` or `categoryType`), always normalize the case (e.g., `jlptLevel?.toUpperCase() as JlptLevel`) before querying Prisma to prevent `PrismaClientValidationError`.

### Payment Flow & Entitlements
- **Bundle Types:** `N5_BUNDLE`, `N4_BUNDLE`, `RAPID_FIRE_BUNDLE`, `FULL_ACCESS_BUNDLE`.
- **Concurrency & TOCTOU Defense:** When SSLCommerz triggers browser redirect (`/success`) and webhook (`/ipn`) concurrently, fulfillment executes an atomic conditional update:
  ```sql
  UPDATE Transaction SET status = 'SUCCESS' WHERE tranId = ? AND status = 'PENDING'
  ```
  Only the winning query provisions the `UserPurchase` row; concurrent executions resolve idempotently.
- **Fraud Checks:** Validations verify gateway `status === "VALID"`, amount match, currency match (`BDT`), store ID match, and transaction ID match.
- **Entitlement Checks:**
  - Non-free modules require `FULL_ACCESS_BUNDLE`, `N5_BUNDLE`, or `N4_BUNDLE`.
  - Rapid-fire drills allow 3 free sessions/day; unlimited sessions require `RAPID_FIRE_BUNDLE` or `FULL_ACCESS_BUNDLE`.
  - Role `ADMIN` bypasses all purchase restrictions.

---

## 5. Environment Variables Reference

Key environment variables documented in `.env.example`:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | MySQL/PostgreSQL connection string | `mysql://user:pass@host:3306/mokushi` |
| `PORT` | HTTP server port | `8000` |
| `NODE_ENV` | Application environment | `development` / `production` |
| `FRONTEND_URL` | Primary frontend web URL | `https://dev.mokushiken.com` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `https://dev.mokushiken.com,https://mokushiken.com` |
| `JWT_ACCESS_SECRET` | Secret key for signing access JWTs | Random 64-char string |
| `JWT_REFRESH_SECRET` | Secret key for signing refresh JWTs | Random 64-char string |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifespan | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifespan | `7d` |
| `REDIS_URL` | Redis connection URL for caching | `redis://localhost:6379` |
| `SSLCOMMERZ_STORE_ID` | Merchant store ID for SSLCommerz | Merchant ID |
| `SSLCOMMERZ_STORE_PASSWORD` | Merchant secret password | Merchant Secret |
| `SSLCOMMERZ_IS_LIVE` | SSLCommerz sandbox toggle | `false` (sandbox) / `true` (live) |
