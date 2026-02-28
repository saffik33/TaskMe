FROM node:20-slim

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .

ARG VITE_API_URL=https://backend-production-6edb0.up.railway.app/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

RUN npm install -g serve

CMD serve dist -s -l ${PORT:-3000}
