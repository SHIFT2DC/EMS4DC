FROM node:25-alpine

WORKDIR /app

ARG HTTP_PROXY
ARG HTTPS_PROXY

RUN if [ -n "$HTTP_PROXY" ]; then npm config set proxy $HTTP_PROXY; fi \
    && if [ -n "$HTTPS_PROXY" ]; then npm config set https-proxy $HTTPS_PROXY; fi

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm install

# Copy source — in dev, this is overridden by a volume mount
COPY . .

EXPOSE 5173

# --host 0.0.0.0 is required so Vite listens outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]