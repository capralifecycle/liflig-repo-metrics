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

# ==============================================================================
# Local helpers
# ==============================================================================

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

# download data from remote sources to S3
# requires admin access to incubator account
# NB: tailing the log currently times out until snapshots are remodeled
.PHONY: collect-remotely
collect-remotely:
	aws lambda invoke --function-name incub-repo-metrics-main-Collector9EBA7CF5-1PVWAMAFCF1ZJ --log-type Tail outfile-collector.json

# aggregate S3 data into a webapp-friendly format
# requires admin access to incubator account
.PHONY: aggregate-remotely
aggregate-remotely:
	aws lambda invoke --function-name incub-repo-metrics-main-Aggregator84F1B3DF-17LMXCOQOEV3X --log-type Tail outfile-aggregator.json
