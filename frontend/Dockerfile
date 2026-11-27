# Production image for the website (CCD-249 Deploy frontend).
# Step 1 builds the React site with Node; step 2 copies only the finished files into Caddy.

# --- Step 1: build ---
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The API is on the same address as the site, so the frontend calls "/api/..."
ENV VITE_API_URL=/api
RUN npm run build

# --- Step 2: serve ---
FROM caddy:2
COPY --from=build /app/dist /srv/site