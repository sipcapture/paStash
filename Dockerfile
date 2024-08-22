# PaStash Docker Builder
FROM node:20-slim as builder
RUN apt update && apt install -y python3 make gcc g++
RUN mkdir -p /app
WORKDIR /app
COPY package.json /app/
RUN npm install
COPY . /app

# PaStash Docker Container
FROM node:20-slim
RUN mkdir -p /config
COPY --from=builder /app /app
WORKDIR /app
EXPOSE 8080
CMD [ "bin/pastash", "--config_dir", "/config" ]
