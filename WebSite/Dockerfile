FROM node:20-slim

WORKDIR /app

RUN npm install -g serve

COPY WebSite/ .

CMD serve . -s -l ${PORT:-3000}
