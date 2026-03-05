FROM node:22-slim AS build
WORKDIR /app

COPY package.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm install --workspace=packages/shared --workspace=apps/web

COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/
RUN npm run build -w apps/web

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
