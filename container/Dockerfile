FROM node:12

EXPOSE 8080

WORKDIR /api-gateway

COPY service /api-gateway

RUN yarn install

CMD yarn start
