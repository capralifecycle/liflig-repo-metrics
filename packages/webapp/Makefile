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

.PHONY: clean
clean:
	rm -rf dist
	rm -rf build
	rm -rf coverage

.PHONY: clean-all
clean-all: clean
	rm -rf node_modules

.PHONY: lint
lint:
	npm run lint
