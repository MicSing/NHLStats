FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV VITE_PROXY_TARGET=http://backend:5267
EXPOSE 5173

CMD ["npm", "run", "dev"]
