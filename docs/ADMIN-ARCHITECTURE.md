# Admin Panel Architecture

## Separation of concerns

```
Android App  ──HTTPS──►  Ruznamo Backend API  ◄──HTTPS──  Admin Panel (separate web app)
                              │
                              ▼
                         PostgreSQL
```

## Current status

| Component | Status |
|-----------|--------|
| Admin API (`/api/v1/admin/*`) | **Not implemented** (BLOCK 6) |
| Admin Panel UI | **Not implemented** (separate repository recommended) |
| RBAC schema in PostgreSQL | ✅ seeded (roles + permissions) |

## Repository strategy (recommended)

```
D:\Ruznamo-Backend     → NestJS API only
D:\Ruznamo-Admin       → Tile Admin / Tailwind frontend (future)
```

Do **not** embed admin UI inside the NestJS backend repository unless explicitly chosen later.

## Admin Panel responsibilities

The Admin Panel is a browser application for administrators. It must:

- authenticate against Admin API
- never connect to PostgreSQL directly
- use JWT with `aud: ruznamo-admin`
- respect RBAC permissions server-side (UI hiding is not security)

## Planned Admin API areas (BLOCK 6)

| Area | Endpoints prefix |
|------|------------------|
| Dashboard | `/api/v1/admin/dashboard` |
| Users | `/api/v1/admin/users` |
| Devices | `/api/v1/admin/devices` |
| Licenses | `/api/v1/admin/licenses` |
| Orders | `/api/v1/admin/orders` |
| Receipts | `/api/v1/admin/receipts` |
| Config | `/api/v1/admin/config` |
| Audit | `/api/v1/admin/audit` |

See `docs/API-CONTRACT.md` for endpoint shapes.

## RBAC roles (seeded)

| Role | Purpose |
|------|---------|
| `SUPER_ADMIN` | all permissions |
| `ADMIN` | users, licenses, orders, approve/reject |
| `SUPPORT` | read-only + limited actions |

Permissions examples: `orders:approve`, `licenses:revoke`, `config:update`.

## Next steps

1. Fix Vercel API deployment ✅
2. Implement BLOCK 2–6 backend APIs
3. Create `Ruznamo-Admin` frontend repository
4. Connect Admin Panel to `/api/v1/admin/*`
