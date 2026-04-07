FROM node:25-alpine3.22 AS builder
WORKDIR /app
RUN apk add --no-cache python3 py3-pip build-base
RUN ln -sf python3 /usr/bin/python
COPY . .
RUN yarn run build-webapp
RUN yarn install --production --prefer-offline --frozen-lockfile

FROM node:25-alpine3.22 AS runner
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/webapp/dist ./webapp/dist
# TODO : Consider having a build step rather than moving src into runner

COPY index.ts server.ts events.ts plugin storage ./
EXPOSE 9000
CMD ["yarn", "run", "run"]