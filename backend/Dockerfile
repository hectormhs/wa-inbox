FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

ARG CACHEBUST=0
COPY src ./src

EXPOSE 3000

CMD ["node", "src/index.js"]
