FROM node:22-alpine

ARG CACHEBUST

ENV HOST=0.0.0.0
ENV PORT=5173

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN echo "Cache bust: $CACHEBUST"

CMD ["sh", "-c", "\
  rm -rf node_modules/.vite && \
  if [ \"$NODE_ENV\" = \"development\" ]; then \
    npm run dev -- --host; \
  else \
    tail -f /dev/null; \
  fi \
"]