# Repository Guidelines

## Project Structure & Module Organization
This repository has two main areas:
- `docs/`: product and process specs (`00_INTENCION.md`, `01_MODULOS.md`, rules and critical flows).
- `web/`: Next.js 16 + TypeScript application.

Inside `web/src/`:
- `app/`: App Router pages, server actions, and API routes.
- `modules/`: domain/application modules (for example `employees`, `restaurants`, `area_leads`).
- `shared/`: shared runtime utilities (Supabase clients, env helpers).

Use the `@/*` alias for imports from `web/src/*`.

## Build, Test, and Development Commands
Run commands from `web/`:
- `npm install`: install dependencies.
- `npm run dev`: start local dev server at `http://localhost:3000`.
- `npm run build`: production build validation.
- `npm run start`: run built app.
- `npm run lint`: run ESLint checks.
- `npm run lint:fix`: auto-fix lint issues where possible.
- `npm run format`: format codebase with Prettier.

## Coding Style & Naming Conventions
- Indentation: 2 spaces, UTF-8, LF endings (see `.editorconfig`).
- Language: strict TypeScript (`web/tsconfig.json`), React 19, Next App Router.
- Filenames: route files follow Next conventions (`page.tsx`, `layout.tsx`, `route.ts`, `actions.ts`).
- Module organization: keep business logic in `modules/<domain>/application` and core types in `modules/<domain>/domain`.
- Linting: `eslint-config-next` + `simple-import-sort` + `unused-imports`; keep imports sorted and remove unused symbols.

## Testing Guidelines
No test runner is configured yet. Minimum quality gate is:
- `npm run lint`
- `npm run build`

When adding tests, prefer colocated `*.test.ts` or `*.test.tsx` files near the module they cover, and prioritize application/domain logic in `web/src/modules/`.

## Commit & Pull Request Guidelines
Current history uses short, task-focused messages (for example: `B00: skeleton modular + prettier/eslint + line-endings`). Follow this style:
- Prefix with a scope or milestone (`B01`, `employees`, `auth`).
- Use imperative, concise summaries.

For PRs include:
- Clear description of what changed and why.
- Linked issue/ticket when available.
- UI screenshots for page changes (`web/src/app/**`).
- Verification notes with executed commands (for example `npm run lint`, `npm run build`).
