.PHONY: help dev up down lint lint-backend lint-frontend test test-backend test-frontend build build-frontend qa qa-smoke _clean

PYTHON ?= venv/bin/python
PIP ?= $(PYTHON) -m pip
BACKEND_MANAGE := $(PYTHON) backend/manage.py
FRONTEND_NPM := npm --prefix frontend

help:
	@printf "Available targets:\n"
	@printf "  make dev         Start backend and frontend dev servers\n"
	@printf "  make lint        Run backend/frontend checks\n"
	@printf "  make test        Run backend/frontend unit tests\n"
	@printf "  make build       Build the frontend bundle\n"
	@printf "  make qa          Run full Playwright suite\n"
	@printf "  make qa-smoke    Run Playwright smoke suite\n"
	@printf "  make _clean      Remove local build/test artifacts\n"

dev:
	@trap 'kill 0' INT TERM EXIT; \
	$(BACKEND_MANAGE) runserver localhost:8000 & \
	$(FRONTEND_NPM) run dev -- --host localhost --port 5173 & \
	wait

up:
	@printf "No auxiliary services are configured yet.\n"

down:
	@printf "No auxiliary services are configured yet.\n"

lint: lint-backend lint-frontend

lint-backend:
	$(BACKEND_MANAGE) check

lint-frontend:
	$(FRONTEND_NPM) run lint

test: test-backend test-frontend

test-backend:
	$(PYTHON) -m pytest backend

test-frontend:
	$(FRONTEND_NPM) run test -- --run

build: build-frontend

build-frontend:
	$(FRONTEND_NPM) run build

qa:
	$(FRONTEND_NPM) run test:e2e

qa-smoke:
	$(FRONTEND_NPM) run test:e2e:smoke

_clean:
	@python3 -c "from pathlib import Path; import shutil; paths = ['frontend/dist', '.pytest_cache', 'frontend/.vitest', 'frontend/playwright-report', 'frontend/test-results']; [shutil.rmtree(p, ignore_errors=True) if Path(p).is_dir() else Path(p).unlink(missing_ok=True) for p in paths]"
