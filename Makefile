types   = packages/repo-collector-types
lambdas = packages/repo-collector
webapp  = packages/webapp
infra   = packages/infrastructure

# ==============================================================================
# Build
# ==============================================================================
.PHONY: all
all: build

.PHONY: build
build: types lambdas webapp infra

.PHONY: types
types:
	@$(MAKE) -C $(types) build

.PHONY: lambdas
lambdas:
	@$(MAKE) -C $(lambdas) build

.PHONY: webapp
webapp:
	@$(MAKE) -C $(webapp) build

.PHONY: infra
infra:
	@$(MAKE) -C $(infra) build

# ==============================================================================
# Local helpers
# ==============================================================================

.PHONY: collect-locally
collect-locally:
	@$(MAKE) -C $(lambdas) collect-locally

.PHONY: aggregate-locally
aggregate-locally:
	@$(MAKE) -C $(lambdas) aggregate-locally

.PHONY: download-s3-data
download-s3-data:
	@$(MAKE) -C $(lambdas) download-s3-data

.PHONY: serve-local-data
serve-local-data:
	@$(MAKE) -C $(lambdas) serve

.PHONY: start-webserver
start-webserver:
	@$(MAKE) -C $(webapp) start-webserver

# ==============================================================================
# Remote helpers (affects running instance of repo metrics)
# ==============================================================================

# download data from remote sources to S3
.PHONY: collect-remotely
collect-remotely:
	@$(MAKE) -C $(lambdas) collect-remotely

# aggregate S3 data into a webapp-friendly format
.PHONY: aggregate-remotely
aggregate-remotely:
	@$(MAKE) -C $(lambdas) aggregate-remotely
