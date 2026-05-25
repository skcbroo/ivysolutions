# ─── stage 1: build Vite ───
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ─── stage 2: serve com nginx alpine ───
FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# Limita envsubst aos vars específicos para não estragar $remote_addr etc.
ENV NGINX_ENVSUBST_FILTER='^(PORT|BACKEND_URL)$'
ENV PORT=8080
EXPOSE 8080
