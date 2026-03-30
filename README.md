# La Sentadita Hub

PWA interna para operar el dia a dia de la cadena La Sentadita: horarios, tareas, tramites, documentos, incidencias y horas, con permisos por rol y trazabilidad.

## Documentacion oficial

La fuente de verdad activa del proyecto vive en [`canon/`](./canon/).

- `canon/README.md`: indice y politica documental oficial
- `canon/canon_ejecutable_v8_v1.md`: canon primario de implementacion
- `canon/02_GIT_Y_VERCEL_SETUP.md`: guia operativa del repo y despliegue

Documentacion historica:

- `archive/`: planes antiguos y paquetes de referencia congelados
- `docs/legacy/`: especificaciones antiguas y material supersedido
- `docs/backups/`: artefactos de respaldo
- `docs/lighthouse/`: reportes y capturas tecnicas

## Estructura del repositorio

```text
la-sentadita-hub/
|-- archive/        # Planes y paquetes historicos de referencia
|-- canon/          # Canon oficial activo
|-- docs/           # Archivo historico y artefactos
|-- supabase/       # SQL, migraciones y recursos de base de datos
|-- web/            # Aplicacion Next.js
`-- AGENTS.md       # Guia de trabajo para agentes y contribuidores
```

## Requisitos

- Node.js 24.x
- pnpm 10.x
- Proyecto Supabase activo con credenciales

## Desarrollo rapido

```bash
cd web
pnpm install
pnpm dev
```

La app local queda en `http://localhost:3000`.

## Variables de entorno

Minimas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Variables opcionales de integraciones y pruebas estan documentadas en [`web/README.md`](./web/README.md).

## Scripts

Ejecutar desde `web/`:

- `pnpm dev`
- `pnpm build`
- `pnpm start`
- `pnpm lint`
- `pnpm lint:fix`
- `pnpm format`
- `pnpm test:unit`
- `pnpm test:vitest`
- `pnpm test:e2e`

## Calidad minima

```bash
pnpm lint
pnpm build
```

## Nota

Este `README` evita duplicar reglas de negocio detalladas. Si algo aqui contradice un documento en `canon/`, prevalece `canon/`.
