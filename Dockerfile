# PaStash Docker Example
FROM node:latest

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json /usr/src/app/
RUN npm install

COPY . /usr/src/app

EXPOSE 8080
CMD [ "bin/node-logstash-agent", "--config_dir", "/usr/src/app/config" ]

