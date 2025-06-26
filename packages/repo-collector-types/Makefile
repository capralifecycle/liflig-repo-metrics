.PHONY: all
all: build

.PHONY: build
build:
	npm install
	npm run lint
	npm run build

.PHONY: clean
clean:
	rm -rf lib

.PHONY: clean-all
clean-all: clean
	rm -rf node_modules

.PHONY: lint
lint:
	npm run lint
