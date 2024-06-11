.PHONY: all build repo-collector repo-collector-types infrastructure app

all: build
build: repo-collector repo-collector-types webapp infrastructure

repo-collector:
	@$(MAKE) -C packages/repo-collector

repo-collector-types:
	@$(MAKE) -C packages/repo-collector-types

webapp:
	@$(MAKE) -C packages/webapp

infrastructure:
	@$(MAKE) -C packages/infrastructure

