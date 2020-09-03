FROM node:12

EXPOSE 8080

WORKDIR /api-gateway

COPY service /api-gateway
RUN rm -rf node_modules
RUN yarn install --frozen-lockfile && yarn cache clean

CMD yarn start
