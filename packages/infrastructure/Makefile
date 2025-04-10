.PHONY: all
all: build

.PHONY: build
build:
	npm install
	npm run lint
	npm run snapshots

	@# fail if snapshots have uncommitted changes
	git status __snapshots__ && git add __snapshots__ --intent-to-add && git diff --exit-code __snapshots__
