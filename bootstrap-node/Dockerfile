FROM node:14-alpine as builder

RUN apk update && \
  apk add --no-cache python \
  make \
  g++

RUN mkdir /crynchy
WORKDIR /crynchy

COPY package.json package.json
COPY package-lock.json package-lock.json

RUN npm i -g npm@6.14.5
RUN npm ci --only=prod

FROM node:14-alpine as runner

RUN apk update && \
  apk add --no-cache libc6-compat
RUN ln -s /lib/libc.musl-x86_64.so.1 /lib/ld-linux-x86-64.so.2

RUN mkdir /crynchy
COPY --from=builder /crynchy /crynchy
WORKDIR /crynchy

COPY src src
COPY id.json id.json
COPY entrypoint.sh entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]

CMD ["node", "."]
