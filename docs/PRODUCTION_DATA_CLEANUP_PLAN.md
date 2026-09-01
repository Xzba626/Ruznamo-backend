# Production Data Cleanup Plan

**Status:** DRY-RUN ONLY — **no production mutation executed**  
**Generated:** 2026-09-01  
**Repository:** `D:\Ruznamo-Backend`

---

## Policy

- Cleanup runs **only** after explicit human approval.
- Default mode is **DRY-RUN** (counts + sample IDs only).
- Mutation requires: `npx ts-node -P tsconfig.scripts.json scripts/cleanup-confirmed-test-data.ts --apply`
- **Do not** run `--apply` until this plan is reviewed against live DB output.

---

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/forensic-data-audit.ts` | Read-only inventory, license journey trace, heuristic test classification |
| `scripts/cleanup-confirmed-test-data.ts` | Targeted deletion with explicit criteria (dry-run default) |
| `scripts/audit-db-counts.ts` | Quick table counts (legacy) |

Run forensic audit (read-only):

```bash
npx ts-node -P tsconfig.scripts.json scripts/forensic-data-audit.ts
```

Run cleanup dry-run:

```bash
npx ts-node -P tsconfig.scripts.json scripts/cleanup-confirmed-test-data.ts
```

---

## Classification Criteria (conservative)

Rows are candidates **only** when they match **deterministic** test patterns:

### Users
- Email contains: `@example.com`, `@test.`, `test@`, `+test`
- Display name contains: `test user`, `demo user`, `e2e`

### Devices
- Device name contains: `emulator`, `test device`, `android emulator`
- Installation ID starts with: `test-`, `demo-`, `e2e-`

### Audit logs
- Action contains `.test.` OR entityType contains `Test`

### Explicitly NOT classified as test
- Old/inactive records without matching patterns
- Real Telegram purchasers
- Production admin accounts
- Rows with uncertain provenance

---

## Deletion Order (dependency-safe)

When `--apply` is authorized:

1. `LicenseActivation` (matched licenses/devices)
2. `TrialGrant`
3. `LicenseEvent` → `License`
4. `Receipt` → `Order`
5. `TelegramAccount` (for matched users)
6. `RefreshToken` → `DeviceInstallation`
7. `RefreshToken` → `User`
8. `User`
9. `AuditLog` (test-pattern only)

All steps run inside a **single Prisma transaction**.

---

## Dry-Run Output (local attempt)

**Note:** Production Neon was **unreachable** from the audit environment at execution time (`Can't reach database server`). Counts below must be refreshed on a machine with live `DATABASE_URL` before any `--apply`.

Expected dry-run command output shape:

```json
{
  "mode": "DRY_RUN",
  "counts": {
    "users": 0,
    "devices": 0,
    "telegramAccounts": 0,
    "orders": 0,
    "licenses": 0,
    "activations": 0,
    "trials": 0,
    "auditLogs": 0,
    "total": 0
  },
  "warning": "DRY_RUN only. Pass --apply after human review."
}
```

**Action required:** Re-run dry-run from environment with DB access and paste actual counts into this document before approval.

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Delete real purchaser | **High** | Narrow patterns; manual review of `sampleIds` |
| Orphaned FK rows | Medium | Transaction + ordered deletes |
| Audit history loss | Low–Medium | Only `.test.` / `Test` entity patterns |
| Re-pollution from seed | Low | Seed creates reference data only (no fake users) |

---

## Seed Re-pollution Audit

`prisma/seed.ts` creates:
- Permissions / roles
- Plans / prices / features
- System config keys
- Default `AppVersion` **only if none exists** (`1.0.0`)

Seed does **not** create demo users, orders, licenses, or devices. Safe for production reference data.

---

## Approval Gate

Before `--apply`, confirm:

- [ ] Dry-run counts reviewed
- [ ] Sample user/device IDs manually verified as test
- [ ] No production Telegram purchaser in selection
- [ ] Backup/snapshot taken (Neon branch or export)
- [ ] SUPERADMIN authorizes mutation

**Verdict: TEST DATA CLEANUP — C** (plan + script ready; production dry-run and `--apply` not executed)
