# backend/Dockerfile
FROM node:22-alpine

ARG CACHEBUST
ARG NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5173
ENV NODE_ENV=$NODE_ENV

WORKDIR /app

COPY package*.json ./

RUN if [ "$NODE_ENV" = "development" ]; then \
      npm install; \
    else \
      npm install --omit=dev; \
    fi

COPY . .

RUN echo "Cache bust: $CACHEBUST"

CMD if [ "$NODE_ENV" = "development" ]; then \
      npm run dev -- --host; \
    else \
      node src/index.js; \
    fi
