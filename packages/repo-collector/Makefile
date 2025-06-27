.PHONY: all
all: build

.PHONY: build
build:
	npm install
	npm run lint
	npm run test
	npm run build

.PHONY: clean
clean:
	rm -rf dist

.PHONY: clean-all
clean-all: clean
	rm -rf node_modules

.PHONY: lint
lint:
	npm run lint

# ==============================================================================
# Local helpers
# ==============================================================================

.PHONY: update-local-data
update-data-locally: collect-locally aggregate-locally

# collect data from remote sources into local filesystem.
.PHONY: collect-locally
collect-locally:
	npm run collect-locally

# aggregate local data into a webapp-friendly format
.PHONY: aggregate-locally
aggregate-locally:
	npm run aggregate-locally

# report on locally collected snapshot-data
.PHONY: report-locally
report-locally:
	npm run report-locally

# download raw and aggregated data directly from s3
# requires admin access to incubator account
.PHONY: download-s3-data
download-s3-data:
	./fetch-s3-data.sh

# serve local data expected by webapp
.PHONY: serve
serve:
	npm run serve


# ==============================================================================
# Remote helpers (affects running instance of repo metrics)
# ==============================================================================

.PHONY: update-remote-data
update-remote-data:
	aws stepfunctions start-execution --state-machine-arn "arn:aws:states:eu-west-1:001112238813:stateMachine:StateMachine2E01A3A5-2QjhssOgQmZm"
