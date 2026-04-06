FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY . .
RUN mkdir -p src/backend/uploads

EXPOSE 5000

CMD ["npm", "start"]
