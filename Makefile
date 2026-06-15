SHELL := /bin/bash
APP_NAME := turtlicious
NPM := npm
AWS := aws
DOCKER := docker
AWS_REGION ?= us-east-1
NODE_MODULES_STAMP := node_modules/.install-stamp
DOCKER_IMAGE ?= $(APP_NAME):dev
DOCKER_CONTAINER ?= $(APP_NAME)-dev
DOCKER_PORT ?= 8080
DOCKER_TEST_IMAGE ?= $(APP_NAME):test
DOCKER_TEST_TARGET ?= build

export NVM_DIR := $(HOME)/.nvm
# Source nvm and activate the version pinned in .nvmrc before running Node tools.
define c
	if [ -n "$$CI" ]; then \
		:; \
	elif [ -s "$(NVM_DIR)/nvm.sh" ]; then \
		. "$(NVM_DIR)/nvm.sh" && nvm use --silent; \
	else \
		:; \
	fi
endef

.DEFAULT_GOAL := help

.PHONY: help install run build test lint typecheck check preview deploy docker docker-test clean

help: ## Show available targets.
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "%-18s %s\n", $$1, $$2}'

$(NODE_MODULES_STAMP): package.json package-lock.json
	$(c) && $(NPM) ci
	@touch $@

install: $(NODE_MODULES_STAMP) ## Install dependencies from the lockfile when needed.

run: install ## Install dependencies when needed and run the Vite dev server.
	$(c) && $(NPM) run dev -- --open

build: install ## Build the production app.
	$(c) && $(NPM) run build

test: install ## Run unit tests once.
	$(c) && $(NPM) test

lint: install ## Run ESLint.
	$(c) && $(NPM) run lint

typecheck: install ## Run TypeScript checks.
	$(c) && $(NPM) run typecheck

check: lint typecheck test build ## Run all local verification.

preview: install ## Preview the production build locally.
	$(c) && $(NPM) run preview

deploy: build ## Build and deploy dist/ to a preconfigured S3 website bucket.
	@test -n "$(AWS_S3_BUCKET)" || (echo "AWS_S3_BUCKET is required"; exit 1)
	$(AWS) s3 sync dist/ s3://$(AWS_S3_BUCKET) --delete --region $(AWS_REGION)

docker: ## Build and run the app container at http://localhost:$(DOCKER_PORT).
	$(DOCKER) build -t $(DOCKER_IMAGE) .
	-$(DOCKER) rm -f $(DOCKER_CONTAINER)
	$(DOCKER) run --name $(DOCKER_CONTAINER) --rm -p $(DOCKER_PORT):80 $(DOCKER_IMAGE)

docker-test: ## Build a test image and run unit tests in Docker.
	$(DOCKER) build --target $(DOCKER_TEST_TARGET) -t $(DOCKER_TEST_IMAGE) .
	$(DOCKER) run --rm $(DOCKER_TEST_IMAGE) npm test

clean: ## Remove generated local artifacts.
	rm -rf dist coverage node_modules
