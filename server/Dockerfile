# Build context = repo root:  docker build -f server/Dockerfile -t command-center-push .
FROM node:20-alpine

WORKDIR /app

# Install deps at /app root so both server/*.js and the reused api/src/lib/*
# modules resolve @azure/* and express from /app/node_modules.
COPY server/package.json ./package.json
RUN npm install --omit=dev

# Bring in the server and the shared library it imports.
COPY api ./api
COPY server ./server

# Optional: include a prebuilt frontend to serve from the same container.
# (Run `npm run build` at the repo root first, then uncomment.)
# COPY dist ./dist

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/index.js"]
