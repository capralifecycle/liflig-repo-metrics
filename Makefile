.PHONY: all
all: build

.PHONY: build
build: types app webapp infra

.PHONY: app
app:
	@$(MAKE) -C packages/repo-collector

.PHONY: types
types:
	@$(MAKE) -C packages/repo-collector-types

.PHONY: webapp
webapp:
	@$(MAKE) -C packages/webapp

.PHONY: infra
infra:
	@$(MAKE) -C packages/infrastructure

