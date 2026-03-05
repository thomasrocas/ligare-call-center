#!/bin/bash
# Ligare Call Center — Demo Setup Script
# Usage: bash scripts/demo.sh

set -e

echo "🏗️  Installing dependencies..."
npm install

echo "📦  Building shared package..."
npm run build -w packages/shared

echo "🗄️  Setting up database..."
cd apps/api
npx prisma migrate dev --name init --skip-generate 2>/dev/null || npx prisma migrate deploy
npx prisma generate
npm run db:seed
cd ../..

echo ""
echo "✅ Demo environment ready!"
echo ""
echo "Start the app:"
echo "  npm run dev"
echo ""
echo "Then open: http://localhost:5173"
echo ""
echo "📧 Login accounts:"
echo "  owner@ligare.com / password123 (OWNER — full access)"
echo "  admin@ligare.com / password123 (ADMIN — full access)"
echo "  supervisor@ligare.com / password123 (SUPERVISOR — calls + dashboard)"
echo "  agent1@ligare.com / password123 (AGENT — calls only)"
echo "  auditor@ligare.com / password123 (AUDITOR — read-only + dashboard)"
echo ""
echo "🎯 Try this:"
echo "  1. Login as owner → see dashboard with charts"
echo "  2. Go to Calls → create a new call"
echo "  3. Start the call → watch the live timer"
echo "  4. Complete or transfer the call"
echo "  5. Check dashboard → KPIs update in realtime"
echo "  6. Export CSV from the calls page"
echo "  7. Login as agent1 → notice restricted access"
echo ""
