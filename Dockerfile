# Multi-stage Dockerfile for BSV Voting System

# Base stage
FROM node:18-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++

# Dependencies stage
FROM base AS dependencies
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Development dependencies
FROM dependencies AS dev-dependencies
RUN npm ci && \
    npm cache clean --force

# Build stage
FROM dev-dependencies AS build
COPY . .
RUN npm run build && \
    npm run compile

# Development stage
FROM dev-dependencies AS development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/artifacts ./artifacts
COPY package*.json ./
COPY .env.example ./.env.example

ENV NODE_ENV=production
EXPOSE 3000

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs

CMD ["node", "dist/index.js"]
