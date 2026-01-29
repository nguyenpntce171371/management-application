FROM node:22-alpine

ARG CACHEBUST
ARG APP_MODE=development
ENV HOST=0.0.0.0
ENV PORT=3000
ENV APP_MODE=$APP_MODE

WORKDIR /app

RUN apk add --no-cache mongodb-tools redis tar gzip

COPY package*.json ./

RUN if [ "$APP_MODE" = "development" ]; then \
      npm install; \
    else \
      npm install --omit=dev; \
    fi

COPY . .

RUN echo "Cache bust: $CACHEBUST"

CMD ["sh", "-c", "\
  if [ \"$APP_MODE\" = \"development\" ]; then \
    npm run dev -- --host; \
  else \
    node src/index.js; \
  fi \
"]
