SHELL := /bin/bash
APP_NAME := turtlicious
NPM := npm
AWS := aws
AWS_REGION ?= us-east-1
NODE_MODULES_STAMP := node_modules/.install-stamp

export NVM_DIR := $(HOME)/.nvm
# Source nvm and activate the version pinned in .nvmrc before running Node tools.
define nvm_use
	[ -s "$(NVM_DIR)/nvm.sh" ] && . "$(NVM_DIR)/nvm.sh" && nvm use --silent
endef

.DEFAULT_GOAL := help

.PHONY: help install run build test lint typecheck check preview deploy clean

help: ## Show available targets.
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "%-18s %s\n", $$1, $$2}'

$(NODE_MODULES_STAMP): package.json package-lock.json
	$(nvm_use) && $(NPM) ci
	@touch $@

install: $(NODE_MODULES_STAMP) ## Install dependencies from the lockfile when needed.

run: install ## Install dependencies when needed and run the Vite dev server.
	$(nvm_use) && $(NPM) run dev -- --open

build: install ## Build the production app.
	$(nvm_use) && $(NPM) run build

test: install ## Run unit tests once.
	$(nvm_use) && $(NPM) test

lint: install ## Run ESLint.
	$(nvm_use) && $(NPM) run lint

typecheck: install ## Run TypeScript checks.
	$(nvm_use) && $(NPM) run typecheck

check: lint typecheck test build ## Run all local verification.

preview: install ## Preview the production build locally.
	$(nvm_use) && $(NPM) run preview

deploy: build ## Build and deploy dist/ to a preconfigured S3 website bucket.
	@test -n "$(AWS_S3_BUCKET)" || (echo "AWS_S3_BUCKET is required"; exit 1)
	$(AWS) s3 sync dist/ s3://$(AWS_S3_BUCKET) --delete --region $(AWS_REGION)

clean: ## Remove generated local artifacts.
	rm -rf dist coverage node_modules
