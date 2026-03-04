# Ligare Call Center SPEC

## MVP Scope
- Live call management with timer and audit trail
- Mission control dashboard with realtime KPI tiles/charts
- RBAC enforcement on every endpoint
- CSV exports with role checks
- Admin UI for users/categories/priorities

## RBAC Roles
OWNER, ADMIN, SUPERVISOR, AGENT, AUDITOR

## Teams
HH, HO (expandable)

## API (initial)
- POST /api/calls
- POST /api/calls/{id}/start
- POST /api/calls/{id}/complete
- POST /api/calls/{id}/transfer
- GET /api/dashboard
- GET /api/exports/calls.csv
