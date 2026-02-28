FROM node:20-slim

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

RUN npm install -g serve

CMD serve dist -s -l ${PORT:-3000}
