FROM node:22-slim AS base
WORKDIR /app

# Install dependencies
COPY package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm install --workspace=packages/shared --workspace=apps/api

# Build shared
COPY packages/shared/ packages/shared/
RUN npm run build -w packages/shared

# Build API
COPY apps/api/ apps/api/
RUN cd apps/api && npx prisma generate
RUN npm run build -w apps/api

# Production
FROM node:22-slim
WORKDIR /app
COPY --from=base /app .
ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "cd apps/api && npx prisma migrate deploy && node dist/server.js"]
