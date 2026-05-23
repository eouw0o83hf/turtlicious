SHELL := /bin/sh
APP_NAME := turtlicious
NPM := npm
NODE_MODULES_STAMP := node_modules/.install-stamp

.DEFAULT_GOAL := help

.PHONY: help install run build test lint typecheck check preview clean

help: ## Show available targets.
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "%-18s %s\n", $$1, $$2}'

$(NODE_MODULES_STAMP): package.json package-lock.json
	$(NPM) ci
	@touch $@

install: $(NODE_MODULES_STAMP) ## Install dependencies from the lockfile when needed.

run: install ## Install dependencies when needed and run the Vite dev server.
	$(NPM) run dev

build: install ## Build the production app.
	$(NPM) run build

test: install ## Run unit tests once.
	$(NPM) test

lint: install ## Run ESLint.
	$(NPM) run lint

typecheck: install ## Run TypeScript checks.
	$(NPM) run typecheck

check: lint typecheck test build ## Run all local verification.

preview: install ## Preview the production build locally.
	$(NPM) run preview

clean: ## Remove generated local artifacts.
	rm -rf dist coverage node_modules
