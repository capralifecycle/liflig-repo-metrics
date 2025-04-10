.PHONY: all
all: build

.PHONY: build
build:
	npm install
	npm run lint
	npm run build
	npm run test

# start webserver. expectes locally served data
.PHONY: start-webserver
start-webserver:
	npm run start
