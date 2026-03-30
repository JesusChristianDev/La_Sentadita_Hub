# Git y Vercel Setup

## Objetivo

Versionar todo el proyecto desde la raiz del repo y desplegar solamente la app `web/` en Vercel.

## Alcance del repo

Se versionan:

- `docs/`
- `supabase/`
- `web/`
- `AGENTS.md`
- `.agents/` si se decide conservar la configuracion local del proyecto

No se versionan:

- `web/node_modules/`
- `web/.next/`
- `web/.env.local`
- `web/.vercel/`
- `docs/lighthouse/`
- `screenshots_error/`
- `docs/backups/*.zip`

## Flujo Git recomendado

Desde `C:\la-sentadita-hub`:

```bash
git init
git add .
git commit -m "B05: prep repo for git and vercel"
git branch -M main
git remote add origin <tu-url-remota>
git push -u origin main
```

## Preparacion para Vercel

1. Importar el repositorio en Vercel.
2. Configurar `web/` como Root Directory del proyecto.
3. Mantener el framework como `Next.js`.
4. Usar los comandos por defecto:
   - Install Command: `npm install`
   - Build Command: `npm run build`
5. Cargar las variables de entorno en los ambientes necesarios.

## Variables de entorno en Vercel

Obligatorias:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Opcionales:

- `E2E_LOGIN_DELAY_MS`

Las credenciales E2E (`E2E_LOGIN_EMAIL`, `E2E_LOGIN_PASSWORD`) no son necesarias para produccion. Solo cargarlas si se van a ejecutar pruebas automatizadas contra previews o entornos controlados.

## Verificacion minima previa al deploy

Desde `web/`:

```bash
npm run lint
npm run build
```

## Nota operativa

`web/` ya integra `@vercel/analytics` y `@vercel/speed-insights`, por lo que el deploy en Vercel no requiere codigo adicional para observabilidad basica.
