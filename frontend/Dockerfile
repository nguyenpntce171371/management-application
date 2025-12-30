FROM node:22-alpine

ARG NODE_ENV
ARG CACHEBUST

WORKDIR /app

COPY package*.json ./
RUN npm install

RUN echo "Cache bust: $CACHEBUST"

COPY . .

RUN if [ "$NODE_ENV" = "production" ]; then \
      npm run build; \
    fi

ENV HOST=0.0.0.0
ENV PORT=5173
EXPOSE 5173

CMD ["sh", "-c", "rm -rf node_modules/.vite && \
  if [ \"$NODE_ENV\" = \"production\" ]; then \
    npm run preview -- --host --port 5173; \
  else \
    npm run dev -- --host; \
  fi"]
