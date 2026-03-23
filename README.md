# La Sentadita Hub

> PWA interna para gestionar la operación diaria de una cadena de restaurantes: horarios, tareas, trámites, documentos, incidencias y reportes de horas, con permisos por rol y trazabilidad completa.

---

## ¿Qué es esto?

**La Sentadita Hub** es una aplicación web progresiva (PWA) diseñada para managers y empleados de restaurantes. Centraliza y digitaliza los flujos operativos del día a día: desde la publicación de horarios hasta la gestión de incidencias, pasando por control de tareas, trámites internos y reportes de horas.

### Módulos incluidos

| Módulo | Estado | Descripción |
|---|---|---|
| 🔐 Auth | ✅ MUST | Login, verificación de email, reset de contraseña, `must_change_password` |
| 👥 Empleados | ✅ MUST | Perfiles, roles, puestos, áreas, `employee_code` |
| 🏢 Restaurantes | ✅ MUST | Multi-restaurante desde el primer día |
| 📅 Horarios | ✅ MUST | Draft compartido → publicado, editor tipo Excel con locks |
| ✅ Tareas | ✅ MUST | Plantillas, asignación y checklists |
| 📋 Trámites | ✅ SHOULD | Vacaciones, baja/enfermedad, workflow en 2 pasos |
| 📄 Documentos | ✅ SHOULD | Nóminas y contratos PDF con confirmación |
| 📢 Anuncios | ✅ SHOULD | Comunicados y normas internas |
| ⚠️ Incidencias | ✅ SHOULD | Tipos editables, severidad y recordatorios SLA |
| ⏱️ Horas | ✅ MUST | Horas planificadas, ajuste y reales + reportes + export |
| 🔔 Notificaciones | 🔧 SHOULD | Push opt-in con overrides urgentes |
| 🕵️ Auditoría | ✅ MUST | Registro completo de cambios (sin UI por ahora) |
| 🛒 Proveedores | 🔧 Experimental | Gestión básica de suppliers |

---

## Stack tecnológico

- **Frontend**: [Next.js 16](https://nextjs.org/) App Router + React 19 + TypeScript
- **Backend / DB**: [Supabase](https://supabase.com/) (PostgreSQL + Auth + Storage + RLS)
- **Estilo**: CSS personalizado + componentes propios
- **PWA**: Service Worker, manifest, soporte offline básico
- **Testing**: Vitest (unitario), E2E opcional con credenciales de entorno
- **Deploy**: Vercel (carpeta `web/`)

---

## Estructura del repositorio

```
la-sentadita-hub/
├── docs/               # Especificaciones, reglas de negocio y flujos críticos
│   ├── 00_INTENCION.md
│   ├── 01_MODULOS.md
│   └── ...
├── supabase/
│   └── migrations/     # Migraciones SQL versionadas
├── web/                # Aplicación Next.js
│   └── src/
│       ├── app/        # App Router: páginas, layouts, API routes, server actions
│       ├── modules/    # Módulos de dominio (employees, schedule, tasks, ...)
│       ├── shared/     # Utilidades compartidas (clientes Supabase, helpers)
│       └── lib/        # Librerías auxiliares
└── AGENTS.md           # Guía de contribución para AI agents
```

---

## Requisitos previos

- **Node.js** 20+ (ver `.nvmrc`)
- **npm** 10+
- Proyecto **Supabase** activo con credenciales

---

## Desarrollo local

### 1. Clonar y entrar al directorio

```bash
git clone https://github.com/<org>/la-sentadita-hub.git
cd la-sentadita-hub/web
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Editar `.env.local` con las credenciales de tu proyecto Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Levantar el servidor de desarrollo

```bash
npm run dev
# → http://localhost:3000
```

---

## Variables de entorno

### Obligatorias

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anon pública de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service role (solo servidor) |

### Opcionales (E2E)

| Variable | Descripción |
|---|---|
| `E2E_LOGIN_EMAIL` | Email del usuario de pruebas E2E |
| `E2E_LOGIN_PASSWORD` | Contraseña del usuario de pruebas E2E |
| `E2E_LOGIN_DELAY_MS` | Delay en ms entre pasos E2E |

---

## Comandos disponibles

Ejecutar desde `web/`:

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción (valida TypeScript + Next)
npm run start        # Servidor de producción (tras build)
npm run lint         # ESLint
npm run lint:fix     # ESLint con auto-fix
npm run format       # Prettier
```

---

## Calidad mínima antes de subir cambios

```bash
npm run lint
npm run build
```

---

## Migraciones de base de datos

Las migraciones SQL están en `supabase/migrations/` y se aplican con la CLI de Supabase o directamente desde el panel de Supabase.

Para aplicar migraciones localmente:

```bash
supabase db push
```

---

## Roles del sistema

| Rol | Descripción |
|---|---|
| `owner` | Acceso total a la plataforma |
| `manager` | Gestión operativa del restaurante |
| `employee` | Acceso de solo lectura a su información |

---

## Arquitectura de módulos

Cada módulo en `web/src/modules/<nombre>/` sigue la misma estructura:

```
modules/employees/
├── domain/          # Tipos, contratos, reglas de negocio puras
├── application/     # Servicios y casos de uso
├── infrastructure/  # Repositorios, queries a Supabase
└── ui/              # Componentes React específicos del módulo
```

Los imports usan el alias `@/*` → `web/src/*`.

---

## Despliegue

El proyecto está configurado para desplegarse en **Vercel** apuntando a la carpeta `web/`.

Variables de entorno de producción se configuran directamente en el panel de Vercel.

---

## Convenciones de commits

```
B00: descripcion breve en imperativo
employees: agregar validacion de employee_code
auth: corregir flujo must_change_password
schedule: publicar horario desde editor Excel
```

---

## Licencia

Uso interno — La Sentadita. No distribuir.
