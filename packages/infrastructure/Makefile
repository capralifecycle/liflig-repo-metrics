.PHONY: all
all: build

.PHONY: build
build:
	npm install
	npm run lint
	npm run snapshots

	@# fail if snapshots have uncommitted changes
	git status __snapshots__ && git add __snapshots__ --intent-to-add && git diff --exit-code __snapshots__

.PHONY: clean
clean:
	rm -rf cdk.out

.PHONY: clean-all
clean-all: clean
	rm -rf node_modules
