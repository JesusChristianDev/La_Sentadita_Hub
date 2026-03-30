# La Sentadita Hub Web

Aplicacion web de operacion interna para La Sentadita Hub, construida con Next.js 16 sobre App Router.

## Stack

- Next.js 16
- React 19
- TypeScript 5.9
- pnpm 10
- Supabase (auth + datos)
- Zod 4 + @t3-oss/env-nextjs
- Sentry (@sentry/nextjs)
- shadcn/ui base readiness
- React Hook Form + @hookform/resolvers
- TanStack Query + @tanstack/react-table
- Recharts
- Resend + @react-email/components
- web-push
- Mindee
- Vitest + Testing Library
- Playwright (E2E)
- Vercel Analytics + Speed Insights

## Requisitos

- Node.js 24 LTS
- pnpm 10
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SENTRY_DSN` opcional
- `RESEND_API_KEY` opcional
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` opcional
- `VAPID_PRIVATE_KEY` opcional
- `VAPID_SUBJECT` opcional
- `MINDEE_API_KEY` opcional

Variables opcionales para pruebas:

- `E2E_LOGIN_EMAIL`
- `E2E_LOGIN_PASSWORD`
- `E2E_LOGIN_DELAY_MS`

Usa `./.env.example` como plantilla para `./.env.local`.
Si usas `nvm`, ejecuta `nvm use` dentro de `web/`.

## Scripts

- `pnpm run dev`: desarrollo local
- `pnpm run build`: build de produccion
- `pnpm run start`: ejecutar el build
- `pnpm run lint`: lint del proyecto
- `pnpm run lint:fix`: auto-fix de lint
- `pnpm run format`: formateo con Prettier
- `pnpm run test:unit`: suite legacy compilada con `node --test`
- `pnpm run test:vitest`: suite nueva de Vitest
- `pnpm run test:e2e`: pruebas E2E con Playwright
- `pnpm run test:e2e:ui`: Playwright en modo UI

## PWA y sesion

- Manifest en `src/app/manifest.ts`
- Service worker en `public/sw.js`
- Registro de PWA en `src/app/components/pwa-register.tsx`
- Instalacion desde `src/app/components/install-pwa-button.tsx`
- Login por server action en `src/app/login/actions.ts`
- Validacion de sesion por proxy en `src/shared/supabase/proxy.ts`

## Desarrollo y despliegue

- El repositorio se versiona desde la raiz `C:\la-sentadita-hub`.
- La app que se despliega en Vercel es esta carpeta: `web/`.
- El gestor de paquetes objetivo desde esta migracion es `pnpm`.
- La guia operativa oficial esta en `../canon/02_GIT_Y_VERCEL_SETUP.md`.
- El canon de negocio oficial esta en `../canon/01_CANON_NEGOCIO_LA_SENTADITA.md`.
- Los paquetes y planes `v8` quedaron archivados en `../archive/` y no son documentacion activa.
- `../docs/legacy/` queda solo como archivo historico y no debe usarse como fuente de verdad.
