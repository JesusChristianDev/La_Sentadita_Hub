# La Sentadita Hub Web

[![CI](https://github.com/JesusChristianDev/La_Sentadita_Hub/actions/workflows/ci.yml/badge.svg)](https://github.com/JesusChristianDev/La_Sentadita_Hub/actions/workflows/ci.yml)

Aplicacion web de operacion interna para La Sentadita Hub, construida con Next.js 16.

## Stack

- Next.js 16 (App Router)
- React 19
- Supabase (auth + datos)
- Playwright (E2E)
- GitHub Actions (CI)

## Requisitos

- Node.js 20+
- Variables de entorno:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-side)

## Scripts

- `npm run dev`: entorno local
- `npm run build`: build de produccion
- `npm run start`: levantar build
- `npm run lint`: lint del proyecto
- `npm run test:e2e`: pruebas E2E con Playwright
- `npm run test:e2e:ui`: Playwright en modo UI

## PWA

- Manifest en `src/app/manifest.ts`
- Service worker en `public/sw.js`
- Registro e instalacion en `src/app/components/pwa-register.tsx`
- Boton de instalacion en `src/app/components/install-pwa-button.tsx`
- Iconos en `public/icons`

## Login y sesion

- Login por server action en `src/app/login/actions.ts`
- Sesion persistente por defecto para evitar cortes en PWA instalada
- Validacion de sesion por proxy en `src/shared/supabase/proxy.ts`

## Testing y CI

- E2E principales en `tests/e2e/login.spec.ts`
- Workflow en `.github/workflows/ci.yml`:
  - Lint
  - E2E (Playwright)
