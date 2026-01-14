FROM node:22-alpine

ARG CACHEBUST
ARG APP_MODE=development

ENV HOST=0.0.0.0
ENV PORT=5173
ENV APP_MODE=$APP_MODE

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN echo "Cache bust: $CACHEBUST"

RUN if [ "$APP_MODE" = "production" ]; then \
      echo "Building for production..."; \
      rm -rf dist && \
      npm run build; \
    fi

CMD ["sh", "-c", "\
  rm -rf node_modules/.vite && \
  if [ \"$APP_MODE\" = \"development\" ]; then \
    npm run dev -- --host; \
  else \
    tail -f /dev/null; \
  fi \
"]