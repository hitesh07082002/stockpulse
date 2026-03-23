# StockPulse CI/CD Strategy

**Status:** Target V1 delivery strategy  
**Date:** Mar 22, 2026  
**Source docs:** [`spec.md`](./spec.md), [`plan.md`](./plan.md), [`architecture.md`](./architecture.md), [`techstack.md`](./techstack.md)

## 1.0 Goals

StockPulse should ship with CI/CD that feels serious, boring, and trustworthy.

That means:
- every PR gets deterministic quality gates
- `main` stays releasable
- deployments use immutable artifacts
- staging and production use the same build output
- database changes are rollout-safe
- broken deploys are easy to detect and easy to roll back

## 2.0 Repository and Branch Strategy

- `main` remains the long-term protected branch
- the current pre-rewrite app should be preserved with a legacy branch or tag such as `legacy/pre-rewrite`
- active rebuild work can happen on a dedicated rewrite branch until the new foundation is ready
- no direct pushes to protected `main`
- all production-bound changes land through pull requests

## 3.0 CI Strategy

## 3.1 Required PR Checks

Every pull request to `main` should run these required checks in parallel where possible:

1. backend lint and static checks
2. backend tests
3. backend coverage
4. frontend lint
5. frontend tests
6. frontend coverage
7. frontend build
8. end-to-end smoke

`main` should not be mergeable unless all required checks pass.

## 3.2 Backend CI

Run on GitHub Actions because the repo is hosted on GitHub.

Recommended backend CI gates:
- install Python from a pinned version
- install backend dependencies from [`backend/requirements.txt`](./backend/requirements.txt)
- run `ruff` once it is added in M1
- run Django config/system checks
- run pytest against PostgreSQL 16, not SQLite
- publish backend coverage outputs for the `stocks` app
- fail on migration drift once migrations stabilize

## 3.3 Frontend CI

Recommended frontend CI gates:
- use a pinned Node version
- run `npm ci` in [`frontend`](./frontend)
- run ESLint
- run Vitest once added in M1
- publish V8 coverage outputs for `frontend/src`
- run Vite production build

## 3.4 End-to-End Smoke

Playwright smoke should run against a real local stack in CI:
- PostgreSQL service container
- backend app
- frontend app

Critical smoke path:
- landing loads
- search works
- stock detail opens
- Financials tab renders
- Google auth entry point is present
- anonymous AI quota flow works

When smoke fails, CI should upload:
- Playwright HTML report
- screenshots
- videos only for failed tests

## 3.5 CI Quality Features

For excellent CI quality, use these defaults:
- GitHub Actions concurrency cancellation on superseded PR pushes
- dependency caching for Python and Node
- separate fast jobs from slower smoke jobs
- artifact upload for test reports and coverage outputs
- branch protection requiring up-to-date checks before merge
- a scheduled security workflow for dependency and code scanning

## 3.6 Security and Supply Chain

Recommended recurring CI jobs:
- CodeQL for Python and JavaScript
- dependency audit for Python and npm
- secret scanning on push and PR
- Dependabot or Renovate for dependency updates

These do not all need to block early feature work, but they should exist before launch.

## 4.0 CD Strategy

## 4.1 Deployment Shape

V1 deployment units:
- `web`: Django API plus built frontend assets
- `worker`: scheduled management-command runner
- `postgres`: managed PostgreSQL 16

The web and worker deploys should be built from the same commit and, ideally, the same base image lineage.

## 4.2 Artifact Strategy

Build once, deploy many.

Recommended approach:
- build immutable Docker images tagged by commit SHA
- produce a web image and a worker image from the same source revision
- never rebuild different artifacts separately for staging and production
- promote the same tested artifact forward

## 4.3 Environment Flow

Recommended environment chain:

1. pull request preview environment if the platform supports it
2. staging auto-deploy from merged `main`
3. production manual promotion from the already-tested staging artifact

If preview environments are too heavy early on, staging plus production is still acceptable, but production should remain a manual promotion step.

## 4.4 Database Migration Strategy

Use expand-contract migrations:
- first deploy schema additions compatible with old and new code
- then deploy app code that uses the new schema
- only remove old fields or paths after they are no longer needed

Rules:
- migrations must run automatically in staging before post-deploy smoke
- production migrations should run in the deploy pipeline, not manually from a laptop
- destructive schema changes require explicit rollback planning

## 4.5 Post-Deploy Verification

Every staging and production deploy should run:
- health check against the backend
- smoke test for landing, stock detail, and auth presence
- a lightweight canary pass for console/runtime failures

For gstack, the most useful deployment-adjacent skills later are:
- `setup-deploy`
- `canary`
- `qa`

## 4.6 Rollback Strategy

Rollback must be boring:
- keep the previous deployable image available
- allow one-click or one-command redeploy of the last known good release
- avoid schema changes that make rollback impossible in the same release
- if a migration is not safely reversible, document the forward-fix path before deploy

## 5.0 Recommended GitHub Actions Layout

Recommended workflows:

- `.github/workflows/ci.yml`
  - PR and push checks
  - backend lint/test
  - frontend lint/test/build
  - Playwright smoke

- `.github/workflows/security.yml`
  - CodeQL
  - dependency audit
  - secret scanning hooks if needed

- `.github/workflows/deploy-staging.yml`
  - trigger on merge to `main`
  - build/publish images
  - run migrations
  - deploy web and worker
  - run post-deploy smoke

- `.github/workflows/deploy-production.yml`
  - manual promotion
  - deploy previously built artifact
  - run health check and canary verification

## 6.0 Launch Bar

Before calling CI/CD launch-ready, StockPulse should have:

- protected `main`
- required PR checks
- deterministic backend and frontend test runs
- Playwright smoke in CI
- immutable deploy artifacts
- staging auto-deploy
- production manual promotion
- automated migrations in deploy pipeline
- post-deploy smoke and rollback path

## 7.0 Non-Goals

Not required for V1:
- multi-region deploys
- blue/green infrastructure
- Kubernetes
- autoscaling worker fleets
- complicated release trains

The right V1 strategy is disciplined, not flashy.
