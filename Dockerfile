FROM node:25-alpine3.22
WORKDIR /app
COPY yarn.lock package.json ./
RUN apk add python3 && ln -sf python3 /usr/bin/python
RUN apk add py3-pip
RUN apk add build-base
RUN yarn install
COPY . .
EXPOSE 9000
CMD ["yarn", "run"]