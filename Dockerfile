# PaStash Docker Example
FROM node:latest

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json /usr/src/app/
RUN npm install

COPY . /usr/src/app

RUN mkdir -p /config

EXPOSE 8080
CMD [ "bin/pastash", "--config_dir", "/config" ]

