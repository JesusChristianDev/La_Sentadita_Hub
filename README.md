# La Sentadita Hub

Repositorio principal de La Sentadita Hub. El proyecto se versiona desde la raiz y despliega solo la app de `web/`.

## Estructura

- `docs/`: specs, reglas de negocio y notas operativas.
- `supabase/`: migraciones SQL del proyecto.
- `web/`: aplicacion Next.js 16 lista para desplegar en Vercel.

## Requisitos

- Node.js 20+
- npm 10+
- proyecto Supabase con credenciales activas

## Desarrollo local

1. Entrar en `web/`.
2. Crear `web/.env.local` a partir de `web/.env.example`.
3. Instalar dependencias con `npm install`.
4. Levantar el proyecto con `npm run dev`.

## Variables de entorno

Obligatorias para la app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Opcionales para pruebas E2E:

- `E2E_LOGIN_EMAIL`
- `E2E_LOGIN_PASSWORD`
- `E2E_LOGIN_DELAY_MS`

## Calidad minima antes de subir cambios

Desde `web/`:

- `npm run lint`
- `npm run build`
- `npm run test:unit`
- `npm run test:e2e` si estan configuradas las credenciales E2E

## Git y despliegue

- El repositorio Git debe inicializarse en la raiz `C:\la-sentadita-hub`.
- La carpeta que se despliega en Vercel es `web/`.
- La guia operativa de versionado y despliegue esta en `docs/19_GIT_Y_VERCEL_SETUP.md`.
