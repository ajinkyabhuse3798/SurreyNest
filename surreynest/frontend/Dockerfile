# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Accept build-time API URL
ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL}
ARG VITE_CLARITY_PROJECT_ID=
ENV VITE_CLARITY_PROJECT_ID=${VITE_CLARITY_PROJECT_ID}

# Install dependencies first (layer caching).
# The current lockfile was generated with a peer-conflict override, so
# Docker must use the same install mode to reproduce the working tree.
COPY package.json package-lock.json ./
RUN npm ci --production=false --legacy-peer-deps

# Copy source and build
COPY . .
RUN npm run build

# ─── Stage 2: Serve ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Copy custom Nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
