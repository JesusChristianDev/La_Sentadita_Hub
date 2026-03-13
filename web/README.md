# La Sentadita Hub Web

Aplicacion web de operacion interna para La Sentadita Hub, construida con Next.js 16 sobre App Router.

## Stack

- Next.js 16
- React 19
- TypeScript estricto
- Supabase (auth + datos)
- Playwright (E2E)
- Vercel Analytics + Speed Insights

## Requisitos

- Node.js 20+
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Variables opcionales para pruebas:

- `E2E_LOGIN_EMAIL`
- `E2E_LOGIN_PASSWORD`
- `E2E_LOGIN_DELAY_MS`

Usa `./.env.example` como plantilla para `./.env.local`.

## Scripts

- `npm run dev`: desarrollo local
- `npm run build`: build de produccion
- `npm run start`: ejecutar el build
- `npm run lint`: lint del proyecto
- `npm run lint:fix`: auto-fix de lint
- `npm run format`: formateo con Prettier
- `npm run test:unit`: suite unitaria compilada con `node --test`
- `npm run test:e2e`: pruebas E2E con Playwright
- `npm run test:e2e:ui`: Playwright en modo UI

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
- La guia operativa esta en `../docs/19_GIT_Y_VERCEL_SETUP.md`.
