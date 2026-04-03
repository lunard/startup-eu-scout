# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-slim AS build

WORKDIR /app

# Install dependencies first (layer cache: only re-run on package changes)
COPY package.json package-lock.json ./
RUN npm ci --quiet

# Copy source and build
COPY . .
RUN npm run build

# ─── Stage 2: Serve ───────────────────────────────────────────────────────────
# nginx:stable-alpine is ~25 MB — ideal for a pure static SPA
FROM nginx:stable-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our nginx template — ${PROXY_EU_API} is substituted at container start
# via the built-in nginx docker-entrypoint envsubst mechanism
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy built static assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# nginx docker image runs envsubst on *.template files before starting nginx
CMD ["nginx", "-g", "daemon off;"]
