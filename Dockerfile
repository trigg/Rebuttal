FROM node:25-alpine3.22
WORKDIR /app
COPY yarn.lock package.json ./
RUN apk add --no-cache python3 && ln -sf python3 /usr/bin/python

COPY . .
RUN yarn install --production --prefer-offline --frozen-lockfile
RUN yarn run build-webapp
EXPOSE 9000
CMD ["yarn", "run", "run"]