FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --no-package-lock --ignore-scripts

COPY . .

EXPOSE 3000

CMD ["node", "--no-warnings", "server.js"]
