# lovechat monorepo

This repository is now a pnpm workspace monorepo with two applications:

- `apps/web`: TanStack Start frontend
- `apps/backend`: Fastify API server (Redis + PostgreSQL)

## Prerequisites

- Node.js 20+
- pnpm
- Docker (for local Redis/PostgreSQL)

## Install

```bash
pnpm install
```

## Start Databases

```bash
docker compose up -d
```

This starts:

- PostgreSQL on `localhost:55432`
- Redis on `localhost:6379`

## Configure Backend Environment

Create the backend env file:

```bash
cp apps/backend/.env.example apps/backend/.env
```

## Run Apps

Run both apps in parallel:

```bash
pnpm dev
```

Run only one app:

```bash
pnpm dev:web
pnpm dev:backend
```

## Useful Scripts

From repo root:

```bash
pnpm build
pnpm lint
pnpm test
pnpm format
pnpm check
```

## Backend Health Check

When the backend is running, verify service connectivity:

```bash
curl http://localhost:4000/health
```
