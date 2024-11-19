.PHONY: all
all: build

.PHONY: build
build: repo-collector repo-collector-types webapp infrastructure

.PHONY: repo-collector
repo-collector:
	@$(MAKE) -C packages/repo-collector

.PHONY: repo-collector-types
repo-collector-types:
	@$(MAKE) -C packages/repo-collector-types

.PHONY: webapp
webapp:
	@$(MAKE) -C packages/webapp

.PHONY: infrastructure
infrastructure:
	@$(MAKE) -C packages/infrastructure

