# Database Schema — Ruznamo Backend (Prisma-oriented design)

> PHASE 1 design document. Implementation in PHASE 2.

---

## Enums

```prisma
enum UserCategory {
  TEACHER
  LECTURER
  TUTOR
  TRAINER
  EMPLOYEE
  STUDENT
  PERSONAL
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  DELETED
}

enum Platform {
  ANDROID
}

enum LicenseStatus {
  PENDING
  ACTIVE
  EXPIRED
  REVOKED
  SUSPENDED
}

enum PlanCode {
  STANDARD
  PRO
  PRO_PLUS
}

enum BillingPeriod {
  MONTHLY
  YEARLY
}

enum OrderStatus {
  PENDING
  RECEIPT_SUBMITTED
  UNDER_REVIEW
  APPROVED
  REJECTED
  CANCELLED
  COMPLETED
}

enum ReceiptStatus {
  PENDING
  APPROVED
  REJECTED
}

enum FeatureValueType {
  INT
  BOOL
  STRING
}

enum AuditActorType {
  USER
  ADMIN
  SYSTEM
  TELEGRAM_BOT
}

enum AdminRoleCode {
  SUPER_ADMIN
  ADMIN
  SUPPORT
}
```

---

## Core models

### User

```prisma
model User {
  id          String       @id @default(cuid())
  displayName String?
  category    UserCategory @default(PERSONAL)
  status      UserStatus   @default(ACTIVE)
  email       String?      @unique
  phone       String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  telegramAccount   TelegramAccount?
  devices           DeviceInstallation[]
  licenses          License[]
  orders            Order[]
  trialGrant        TrialGrant?
  refreshTokens     RefreshToken[]

  @@index([status])
  @@index([createdAt])
}
```

### TelegramAccount

```prisma
model TelegramAccount {
  id         String   @id @default(cuid())
  userId     String   @unique
  telegramId BigInt   @unique
  username   String?
  firstName  String?
  lastName   String?
  linkedAt   DateTime @default(now())
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([telegramId])
}
```

### TelegramLinkToken

```prisma
model TelegramLinkToken {
  id        String   @id @default(cuid())
  userId    String
  code      String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

### DeviceInstallation

```prisma
model DeviceInstallation {
  id              String    @id @default(cuid())
  userId          String
  installationId  String    @unique  // Android UUID — globally unique
  deviceName      String?
  platform        Platform  @default(ANDROID)
  appVersion      String?
  lastSeenAt      DateTime  @default(now())
  revokedAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  user         User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  activations  LicenseActivation[]

  @@index([userId])
  @@index([userId, revokedAt])
}
```

### TrialGrant (anti-abuse)

```prisma
model TrialGrant {
  id             String   @id @default(cuid())
  userId         String   @unique
  installationId String   @unique
  startedAt      DateTime @default(now())
  expiresAt      DateTime
  createdAt      DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## Plans & entitlements

### Plan

```prisma
model Plan {
  id        String   @id @default(cuid())
  code      PlanCode @unique
  name      String
  nameTj    String?
  isActive  Boolean  @default(true)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  prices    PlanPrice[]
  features  PlanFeature[]
  licenses  License[]
  orders    Order[]
}
```

### PlanPrice

```prisma
model PlanPrice {
  id            String        @id @default(cuid())
  planId        String
  billingPeriod BillingPeriod
  amount        Decimal       @db.Decimal(10, 2)
  currency      String        @default("TJS")
  isActive      Boolean       @default(true)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  plan Plan @relation(fields: [planId], references: [id], onDelete: Restrict)

  @@unique([planId, billingPeriod])
}
```

### PlanFeature

```prisma
model PlanFeature {
  id        String           @id @default(cuid())
  planId    String
  key       String           // e.g. max_devices, planning_horizon_days
  value     String
  valueType FeatureValueType
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@unique([planId, key])
}
```

**STANDARD seed features:**

| key | value | type |
|-----|-------|------|
| `planning_horizon_days` | `28` | INT |
| `max_devices` | `1` | INT |
| `cloud_sync` | `false` | BOOL |
| `advanced_analytics` | `false` | BOOL |

**STANDARD seed prices:**

| period | amount | currency |
|--------|--------|----------|
| MONTHLY | 15.00 | TJS |
| YEARLY | 150.00 | TJS |

---

## Licenses

### License

```prisma
model License {
  id          String        @id @default(cuid())
  planId      String
  userId      String?
  orderId     String?       @unique
  keyHash     String        @unique
  keyPrefix   String        // RZNM-ABCD for admin display
  status      LicenseStatus @default(PENDING)
  startsAt    DateTime?
  expiresAt   DateTime?
  activatedAt DateTime?
  revokedAt   DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  plan        Plan                @relation(fields: [planId], references: [id], onDelete: Restrict)
  user        User?               @relation(fields: [userId], references: [id], onDelete: SetNull)
  order       Order?              @relation(fields: [orderId], references: [id], onDelete: SetNull)
  activations LicenseActivation[]
  events      LicenseEvent[]

  @@index([userId])
  @@index([status])
  @@index([expiresAt])
  @@index([keyPrefix])
}
```

### LicenseActivation

```prisma
model LicenseActivation {
  id         String   @id @default(cuid())
  licenseId  String
  deviceId   String
  createdAt  DateTime @default(now())

  license License            @relation(fields: [licenseId], references: [id], onDelete: Cascade)
  device  DeviceInstallation @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@unique([licenseId, deviceId])
}
```

### LicenseEvent

```prisma
model LicenseEvent {
  id         String        @id @default(cuid())
  licenseId  String
  fromStatus LicenseStatus?
  toStatus   LicenseStatus
  reason     String?
  metadata   Json?
  createdAt  DateTime      @default(now())

  license License @relation(fields: [licenseId], references: [id], onDelete: Cascade)

  @@index([licenseId, createdAt])
}
```

---

## Orders & receipts

### Order

```prisma
model Order {
  id            String        @id @default(cuid())
  userId        String
  planId        String
  billingPeriod BillingPeriod
  amount        Decimal       @db.Decimal(10, 2)
  currency      String        @default("TJS")
  status        OrderStatus   @default(PENDING)
  paidAt        DateTime?
  approvedAt    DateTime?
  approvedById  String?
  rejectedAt    DateTime?
  rejectionReason String?
  expiresAt     DateTime?     // order payment window
  idempotencyKey String?      @unique
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Restrict)
  plan      Plan     @relation(fields: [planId], references: [id], onDelete: Restrict)
  approvedBy AdminUser? @relation(fields: [approvedById], references: [id], onDelete: SetNull)
  receipts  Receipt[]
  license   License?

  @@index([userId])
  @@index([status])
  @@index([createdAt])
}
```

### Receipt

```prisma
model Receipt {
  id              String        @id @default(cuid())
  orderId         String
  telegramFileId  String
  fileType        String        // photo, document
  status          ReceiptStatus @default(PENDING)
  submittedAt     DateTime      @default(now())
  reviewedAt      DateTime?
  reviewedById    String?
  rejectionReason String?
  metadata        Json?

  order      Order      @relation(fields: [orderId], references: [id], onDelete: Cascade)
  reviewedBy AdminUser? @relation(fields: [reviewedById], references: [id], onDelete: SetNull)

  @@index([orderId])
  @@index([status])
}
```

---

## Auth sessions

### RefreshToken

```prisma
model RefreshToken {
  id         String    @id @default(cuid())
  userId     String
  tokenHash  String    @unique
  expiresAt  DateTime
  revokedAt  DateTime?
  replacedBy String?
  userAgent  String?
  ipAddress  String?
  createdAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

### AdminUser + RBAC

```prisma
model AdminUser {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  displayName  String?
  telegramId   BigInt?   @unique
  isActive     Boolean   @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  roles           AdminUserRole[]
  approvedOrders  Order[]
  reviewedReceipts Receipt[]
  auditLogs       AuditLog[]

  @@index([isActive])
}

model Role {
  id          String        @id @default(cuid())
  code        AdminRoleCode @unique
  name        String
  permissions RolePermission[]
  admins      AdminUserRole[]
}

model Permission {
  id    String @id @default(cuid())
  code  String @unique  // e.g. orders:approve
  name  String
  roles RolePermission[]
}

model RolePermission {
  roleId       String
  permissionId String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
}

model AdminUserRole {
  adminUserId String
  roleId      String
  adminUser   AdminUser @relation(fields: [adminUserId], references: [id], onDelete: Cascade)
  role        Role      @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([adminUserId, roleId])
}
```

---

## Audit & config

### AuditLog

```prisma
model AuditLog {
  id         String         @id @default(cuid())
  actorType  AuditActorType
  actorId    String?
  action     String         // LICENSE_ACTIVATED, ORDER_APPROVED, ...
  entityType String
  entityId   String?
  metadata   Json?
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime       @default(now())

  adminUser AdminUser? @relation(fields: [actorId], references: [id], onDelete: SetNull)

  @@index([action])
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

### AppVersion

```prisma
model AppVersion {
  id                      String   @id @default(cuid())
  platform                Platform @default(ANDROID)
  latestVersion           String
  minimumSupportedVersion String
  updateUrl               String?
  forceUpdate             Boolean  @default(false)
  releaseNotes            String?
  releaseNotesTj          String?
  isActive                Boolean  @default(true)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  @@index([platform, isActive])
}
```

### SystemConfig

```prisma
model SystemConfig {
  key       String   @id
  value     String
  valueJson Json?
  updatedAt DateTime @updatedAt
}
```

### IdempotencyKey

```prisma
model IdempotencyRecord {
  id             String   @id @default(cuid())
  key            String   @unique
  requestHash    String
  responseStatus Int
  responseBody   Json
  expiresAt      DateTime
  createdAt      DateTime @default(now())

  @@index([expiresAt])
}
```

---

## Indexes summary

| Table | Index | Reason |
|-------|-------|--------|
| User | status, createdAt | Admin lists |
| DeviceInstallation | installationId UNIQUE | Anti-abuse lookup |
| License | keyHash UNIQUE | Activation |
| License | expiresAt | Expiration job |
| Order | status | Admin queue |
| TelegramAccount | telegramId UNIQUE | Bot user resolution |
| TrialGrant | installationId UNIQUE | Trial abuse prevention |

---

## Cascade policy

| Relation | onDelete |
|----------|----------|
| User → devices | Cascade |
| User → licenses | SetNull (preserve license history) |
| Order → license | SetNull |
| Plan → licenses | Restrict (cannot delete sold plan) |
