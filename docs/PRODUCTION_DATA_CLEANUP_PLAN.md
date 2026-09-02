# Production Data Cleanup Plan

**Status:** DRY-RUN ONLY — **no production mutation executed**  
**Generated:** 2026-09-01 | **Revised:** 2026-09-02  
**Repository:** `D:\Ruznamo-Backend`

> **Important:** `0 CONFIRMED TEST rows` in the deterministic cleanup script does **not** mean production is clean. Forensic heuristics (`forensic-data-audit.ts`) may still flag likely-test devices/users. Human review in Admin (Пользователи, Устройства, Лицензии, Аудит) is required before any `--apply`.

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

## Dry-Run Output (production, 2026-09-01)

Deterministic cleanup script (`cleanup-confirmed-test-data.ts`):

```json
{
  "mode": "DRY_RUN",
  "counts": { "users": 0, "devices": 0, "total": 0 },
  "warning": "Nothing matched — no mutation."
}
```

**Interpretation:** Narrow email/name/installation-prefix rules did not auto-select rows. **Production may still contain obvious test data** that does not match these patterns.

Forensic heuristics (read-only, same day) flagged for **manual review** (not auto-delete):

| Category | Count | Examples |
|----------|------:|----------|
| Likely test devices | 4 | `Test Android`, `Local Test`, `Production Test`; fixture UUID installation IDs |
| Likely test users | 1 | `displayName: TestUser` |
| Audit logs with "test" pattern | 0 | — |

**Action required:** Owner reviews Admin lists, supplies explicit IDs for a future targeted cleanup script run. Do not use `--apply` until IDs are confirmed.

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

**Verdict: TEST DATA CLEANUP — B / NEEDS HUMAN CLASSIFICATION** (scripts ready; deterministic dry-run empty; heuristics + visual review pending)
