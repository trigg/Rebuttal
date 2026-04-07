FROM node:25-alpine3.22
WORKDIR /app
COPY yarn.lock package.json ./
RUN yarn install
COPY . .
EXPOSE 9000
CMD ["yarn", "dev", "--host", "0.0.0.0"]