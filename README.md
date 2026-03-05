# Ligare Call Center

A full-stack call center management application with live call tracking, mission control dashboard, RBAC, and CSV exports.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS + Recharts
- **Backend:** Express + TypeScript + Prisma + SQLite
- **Auth:** JWT with role-based access control (RBAC)
- **Deploy:** Docker Compose

## RBAC Roles

| Role | Calls | Dashboard | Export | Admin |
|------|-------|-----------|--------|-------|
| OWNER | ✅ | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ | ✅ |
| SUPERVISOR | ✅ | ✅ | ✅ | ❌ |
| AGENT | ✅ (own) | ❌ | ❌ | ❌ |
| AUDITOR | 👁️ read | ✅ | ✅ | ❌ |

## Quick Start (Development)

```bash
# Install dependencies
npm install

# Build shared package
npm run build -w packages/shared

# Setup database
cd apps/api
npx prisma migrate dev --name init
npm run db:seed
cd ../..

# Start both servers
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

## Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| owner@ligare.com | password123 | OWNER |
| admin@ligare.com | password123 | ADMIN |
| supervisor@ligare.com | password123 | SUPERVISOR |
| agent1@ligare.com | password123 | AGENT |
| agent2@ligare.com | password123 | AGENT |
| auditor@ligare.com | password123 | AUDITOR |

## Production (Docker)

```bash
JWT_SECRET=your-secret-here docker compose up -d --build
```

App available at http://localhost (port 80).

## API Endpoints

- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Current user
- `GET /api/calls` — List calls (filterable)
- `POST /api/calls` — Create call
- `POST /api/calls/:id/start` — Start call timer
- `POST /api/calls/:id/complete` — Complete call
- `POST /api/calls/:id/transfer` — Transfer call
- `GET /api/dashboard` — KPI dashboard data
- `GET /api/exports/calls.csv` — Export calls as CSV
- `GET /api/users` — List users (admin)
- `POST /api/users` — Create user (admin)
- `PATCH /api/users/:id` — Update user (admin)
- `DELETE /api/users/:id` — Deactivate user (admin)
- `GET /api/categories` — List categories
- `POST /api/categories` — Create category (admin)
- `PATCH /api/categories/:id` — Update category (admin)
- `DELETE /api/categories/:id` — Deactivate category (admin)
