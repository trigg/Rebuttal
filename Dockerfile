FROM node:25-alpine3.22 AS server
WORKDIR /app
RUN apk add --no-cache python3 py3-pip make g++ libunwind-dev
COPY . .
RUN yarn install --production --prefer-offline --frozen-lockfile

FROM node:25-alpine3.22 AS webapp
WORKDIR /app
COPY . .
RUN yarn run build-webapp

FROM node:25-alpine3.22 AS runner
RUN apk add --no-cache libunwind
COPY --from=server /app/node_modules ./node_modules
COPY --from=webapp /app/webapp/dist ./webapp/dist
# TODO : Consider having a build step rather than moving src into runner

COPY index.ts server.ts events.ts package.json ./
COPY plugin/ ./plugin
COPY storage/ ./storage
COPY protocol/ ./protocol
EXPOSE 9000
CMD ["yarn", "run", "run"]