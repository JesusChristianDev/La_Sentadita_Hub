# 05 — Stack Tecnológico Completo
## Versiones, roles y razones — congelado en marzo 2026

---

## Stack completo

| Capa | Herramienta | Versión | Coste | Rol en el proyecto |
|---|---|---|---|---|
| Framework | Next.js | 16.1.6 | Gratis | App Router, SSR, API routes, Server Actions |
| Lenguaje | TypeScript | 5.9.3 | Gratis | Tipado estricto en todo el proyecto |
| Runtime | Node.js | 24.x LTS | Gratis | Runtime de servidor |
| Package manager | pnpm | 10.x | Gratis | Gestión de dependencias |
| Base de datos | Supabase / PostgreSQL | última estable | Free / Pro $25/mes | DB, Auth, Storage, Realtime |
| Cliente DB | supabase-js | 2.x | Gratis | Cliente tipado para Supabase |
| Auth en Next.js | @supabase/ssr | última estable | Gratis | Manejo de sesión SSR |
| Validación | Zod | 4.x | Gratis | Validación de inputs, schemas, env vars |
| UI Components | shadcn/ui | última estable | Gratis | Componentes base (tema amber dark/light) |
| Estilos | Tailwind CSS | 4.x | Gratis | Utility-first CSS |
| Formularios | React Hook Form | última estable | Gratis | Gestión de formularios |
| Resolvers | @hookform/resolvers | última estable | Gratis | Integración RHF + Zod |
| Estado cliente | TanStack Query | última estable | Gratis | Server state, caché, sincronización |
| Tablas | @tanstack/react-table | última estable | Gratis | Tablas avanzadas con sorting, filtering |
| Gráficos | Recharts | última estable | Gratis | Dashboards y visualizaciones |
| Fechas | date-fns | última estable | Gratis | Manipulación de fechas |
| Email | Resend | última estable | Free 3.000/mes / Pro $20/mes | Envío de emails transaccionales |
| Email templates | @react-email/components | última estable | Gratis | Templates de email en React |
| Push notifications | web-push | última estable | Gratis | Notificaciones push en navegador |
| Compresión imágenes | browser-image-compression | última estable | Gratis | Optimización antes de subir avatares/docs |
| PWA | @ducanh2912/next-pwa | última estable | Gratis | Capacidades offline y PWA |
| OCR albaranes | Mindee Invoice API | última estable | Pay per use | Extracción de datos de albaranes |
| Monitorización | Sentry (@sentry/nextjs) | última estable | Free 5.000 errores/mes / Team $26/mes | Error tracking y performance |
| Cron jobs | Vercel Cron Jobs | — | Incluido en Vercel Pro | Expiración de locks, tareas programadas |
| Variables de entorno | @t3-oss/env-nextjs | última estable | Gratis | Validación de env vars con Zod |
| Tests unitarios | Vitest | última estable | Gratis | Tests de dominio y casos de uso |
| Tests componentes | Testing Library | última estable | Gratis | Tests de UI |
| Tests E2E | Playwright | última estable | Gratis | Tests de flujos completos |
| Calidad código | Husky + lint-staged | última estable | Gratis | Pre-commit hooks |
| Bundle análisis | @next/bundle-analyzer | última estable | Gratis | Análisis de bundle en build |
| Iconos | lucide-react | última estable | Gratis | Iconos consistentes |
| Deploy | Vercel | — | Hobby gratis / Pro $20/mes | Hosting, CI/CD, Edge Functions |

---

## Coste estimado

| Entorno | Coste mensual |
|---|---|
| Desarrollo y MVP (free tiers) | 0 €/mes |
| Producción mínima real | ~45 €/mes (Vercel Pro $20 + Supabase Pro $25) |
| Producción con monitorización | ~71 €/mes (+ Sentry Team $26) |

---

## Herramientas evaluadas y descartadas

| Herramienta | Razón del descarte |
|---|---|
| Prisma / Drizzle | El SQL está escrito y es complejo. supabase-js con service_role ya da acceso tipado directo |
| bcrypt | Supabase Auth maneja el hashing internamente |
| JWT manual | Supabase Auth emite y verifica los JWTs. Las funciones SQL leen los claims directamente |
| NextAuth / Clerk / Lucia | Supabase Auth ya es el sistema de autenticación. Duplicaría responsabilidades |
| Zustand / Redux Toolkit | App Router gestiona estado en servidor. TanStack Query cubre estado del servidor en cliente |
| Axios | fetch nativo es suficiente. TanStack Query lo abstrae |
| Formik | React Hook Form es mejor en rendimiento y tiene mejor integración con Zod |
| Workbox / vite-plugin-pwa | Vite no está en el stack. @ducanh2912/next-pwa es la solución correcta para Next.js |
| PlanetScale / Neon | Supabase ya elegido |
| Netlify / Railway | Vercel es la elección natural para Next.js |
| Inngest | Vercel Cron Jobs cubre las necesidades actuales. Reconsiderar si los workflows se complican |
| Claude API (OCR) | Mindee es más económico y específico para facturas/albaranes |

---

## Configuración de Supabase

### Funciones SQL de contexto de sesión
```sql
-- Lee el personId del JWT de Supabase Auth
CREATE OR REPLACE FUNCTION current_person_id() RETURNS uuid AS $$
  SELECT (auth.jwt() ->> 'sub')::uuid;
$$ LANGUAGE sql STABLE;

-- Lee el system_role del JWT claim custom
CREATE OR REPLACE FUNCTION current_system_role() RETURNS text AS $$
  SELECT auth.jwt() ->> 'system_role';
$$ LANGUAGE sql STABLE;
```

### Variables de entorno requeridas
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
MINDEE_API_KEY=
SENTRY_DSN=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

---

## Decisiones de UX/UI

- **Tema:** shadcn/ui con tema amber dark/light (Linear-inspired)
- **Horario semanal:** componente custom CSS Grid (no librería externa)
- **Tablas:** @tanstack/react-table con sorting, filtering y paginación
- **Gráficos:** Recharts para dashboards
- **Iconos:** lucide-react en todo el proyecto
