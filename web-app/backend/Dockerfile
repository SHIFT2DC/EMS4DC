FROM node:25-alpine

WORKDIR /app

ARG HTTP_PROXY
ARG HTTPS_PROXY

RUN if [ -n "$HTTP_PROXY" ]; then npm config set proxy $HTTP_PROXY; fi \
    && if [ -n "$HTTPS_PROXY" ]; then npm config set https-proxy $HTTPS_PROXY; fi

COPY package*.json ./
RUN npm install

# Install nodemon globally for hot-reload in development
RUN npm install -g nodemon

COPY . .

EXPOSE 3001

CMD ["nodemon", "--ignore", "conf/", "--ignore", "*.json", "server.js"]