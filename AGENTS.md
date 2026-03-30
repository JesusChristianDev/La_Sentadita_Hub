# Repository Guidelines

## Project Structure & Module Organization
This repository has five relevant documentation/code areas:
- `canon/`: official project canon. New active business or process documentation must live here.
- `archive/`: historical plans and frozen reference packages. Do not treat them as active documentation.
- `docs/legacy/`: historical documentation kept for reference only. Do not treat it as source of truth unless the user explicitly asks for it.
- `docs/backups/` and `docs/lighthouse/`: artifacts, reports, and backups.
- `web/`: Next.js 16 + TypeScript application.

Inside `web/src/`:
- `app/`: App Router pages, server actions, and API routes.
- `modules/`: domain/application modules (for example `employees`, `restaurants`, `area_leads`).
- `shared/`: shared runtime utilities (Supabase clients, env helpers).

Use the `@/*` alias for imports from `web/src/*`.

## Build, Test, and Development Commands
Run commands from `web/`:
- `pnpm install`: install dependencies.
- `pnpm run dev`: start local dev server at `http://localhost:3000`.
- `pnpm run build`: production build validation.
- `pnpm run start`: run built app.
- `pnpm run lint`: run ESLint checks.
- `pnpm run lint:fix`: auto-fix lint issues where possible.
- `pnpm run format`: format codebase with Prettier.
- `pnpm run test:unit`: legacy unit suite compiled with `node --test`.
- `pnpm run test:vitest`: Vitest suite.
- `pnpm run test:e2e`: Playwright end-to-end suite.

## Coding Style & Naming Conventions
- Indentation: 2 spaces, UTF-8, LF endings (see `.editorconfig`).
- Language: strict TypeScript (`web/tsconfig.json`), React 19, Next App Router.
- Filenames: route files follow Next conventions (`page.tsx`, `layout.tsx`, `route.ts`, `actions.ts`).
- Module organization: keep business logic in `modules/<domain>/application` and core types in `modules/<domain>/domain`.
- Linting: `eslint-config-next` + `simple-import-sort` + `unused-imports`; keep imports sorted and remove unused symbols.

## Testing Guidelines
The current minimum quality gate is:
- `pnpm run lint`
- `pnpm run build`

When adding tests, prefer colocated `*.test.ts` or `*.test.tsx` files near the module they cover, prioritize application/domain logic in `web/src/modules/`, and use the existing unit/Vitest/Playwright setup when relevant.

## Commit & Pull Request Guidelines
Current history uses short, task-focused messages (for example: `B00: skeleton modular + prettier/eslint + line-endings`). Follow this style:
- Prefix with a scope or milestone (`B01`, `employees`, `auth`).
- Use imperative, concise summaries.

For PRs include:
- Clear description of what changed and why.
- Linked issue/ticket when available.
- UI screenshots for page changes (`web/src/app/**`).
- Verification notes with executed commands (for example `pnpm run lint`, `pnpm run build`).
