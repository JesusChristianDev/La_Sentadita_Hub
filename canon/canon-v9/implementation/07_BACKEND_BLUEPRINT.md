# 07 — Backend Blueprint
## Patrón de caso de uso, RequestContext y tipos de error

---

## Principio rector

**Frontend tonto, backend inteligente.**

El frontend puede mostrar, validar UX y lanzar acciones. No puede decidir permisos, aprobaciones, visibilidad, ownership ni planificación. Toda decisión de negocio vive en el backend.

---

## RequestContext

Contrato explícito que toda operación de escritura debe construir antes de ejecutarse.

```typescript
// shared/authz/requestContext.ts

export type RequestContext = {
  personId: string          // UUID del actor
  systemRole: SystemRole    // rol canónico del actor
  activeScopeId: string     // UUID del scope activo (restaurant, company, zone...)
  activeScopeType: ScopeType // tipo del scope activo
  traceId: string           // UUID v4 para trazabilidad end-to-end
}

export function buildRequestContext(jwt: JWTPayload): RequestContext {
  return {
    personId: jwt.sub,
    systemRole: jwt.system_role as SystemRole,
    activeScopeId: jwt.active_scope_id,
    activeScopeType: jwt.active_scope_type as ScopeType,
    traceId: crypto.randomUUID(),
  }
}
```

---

## Patrón de caso de uso — 9 pasos

Todo caso de uso de escritura sigue este orden sin excepción:

```typescript
// modules/requests/application/approveRequest.ts

export async function approveRequest(
  ctx: RequestContext,
  input: ApproveRequestInput
): Promise<ApproveRequestResult> {

  // PASO 1 — Validar input (Zod)
  const validated = ApproveRequestSchema.parse(input)

  // PASO 2 — Cargar entidades necesarias
  const request = await requestRepository.findById(validated.requestId)
  if (!request) throw new NotFoundError('Request', validated.requestId)

  // PASO 3 — Verificar autorización
  await assertCan(ctx, 'approve', { resource: 'request', request })

  // PASO 4 — Validar invariantes de negocio
  if (request.personId === ctx.personId) {
    throw new InvariantViolationError('I-020', 'Nadie puede autoaprobar su propia solicitud')
  }
  if (!canApproveByType(ctx.systemRole, request.type)) {
    throw new InvariantViolationError('I-021', `${ctx.systemRole} no puede aprobar ${request.type}`)
  }

  // PASO 5 — Ejecutar operación principal
  const updated = await requestRepository.updateStatus(
    request.id,
    'approved',
    { approvedBy: ctx.personId, approvedAt: new Date() }
  )

  // PASO 6 — Aplicar side effects (en transacción)
  if (blocksSchedule(request.type)) {
    await applyRequestToSchedule(ctx, updated)
  }

  // PASO 7 — Registrar auditoría
  await writeAuditLog({
    traceId: ctx.traceId,
    actorId: ctx.personId,
    actorRole: ctx.systemRole,
    entityType: 'request',
    entityId: request.id,
    action: 'UPDATE',
    previousValue: { status: request.status },
    newValue: { status: 'approved' },
  })

  // PASO 8 — Emitir notificaciones
  await sendNotification({
    event: 'request.approved',
    recipientId: request.personId,
    payload: { requestId: request.id, type: request.type },
  })

  // PASO 9 — Devolver resultado
  return { request: updated }
}
```

---

## Tipos de error canónicos

```typescript
// shared/types/errors.ts

/** El actor no tiene permiso para ejecutar la acción */
export class AuthorizationError extends Error {
  constructor(action: string, resource: string) {
    super(`Not authorized to ${action} on ${resource}`)
    this.name = 'AuthorizationError'
  }
}

/** El input no supera la validación de schema */
export class ValidationError extends Error {
  constructor(message: string, public issues?: unknown) {
    super(message)
    this.name = 'ValidationError'
  }
}

/** La operación viola una regla de negocio invariante */
export class InvariantViolationError extends Error {
  constructor(public invariantCode: string, message: string) {
    super(`[${invariantCode}] ${message}`)
    this.name = 'InvariantViolationError'
  }
}

/** La operación entra en conflicto con el estado actual */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

/** La entidad solicitada no existe */
export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} with id ${id} not found`)
    this.name = 'NotFoundError'
  }
}
```

---

## assertCan — función de autorización

```typescript
// shared/authz/assertCan.ts

export async function assertCan(
  ctx: RequestContext,
  action: string,
  resource: ResourceDescriptor
): Promise<void> {
  const allowed = await can(ctx, action, resource)
  if (!allowed) {
    throw new AuthorizationError(action, resource.resource)
  }
}
```

---

## Patrón de Route Handler (Next.js)

```typescript
// app/(app)/api/requests/[id]/approve/route.ts

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ctx = buildRequestContext(session.user)
    const body = await request.json()
    
    const result = await approveRequest(ctx, { requestId: params.id, ...body })
    
    return NextResponse.json(result)
    
  } catch (error) {
    return handleApiError(error)
  }
}

function handleApiError(error: unknown): NextResponse {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message, issues: error.issues }, { status: 400 })
  }
  if (error instanceof InvariantViolationError) {
    return NextResponse.json({ error: error.message, code: error.invariantCode }, { status: 422 })
  }
  if (error instanceof ConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 })
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
  // Error inesperado — Sentry lo captura
  console.error(error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
```

---

## Patrón de repositorio

```typescript
// modules/requests/infrastructure/requestRepository.ts

export const requestRepository = {
  async findById(id: string): Promise<Request | null> {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('id', id)
      .eq('is_archived', false)
      .single()
    
    if (error) return null
    return data
  },

  async updateStatus(
    id: string, 
    status: RequestStatus,
    meta: { approvedBy: string; approvedAt: Date }
  ): Promise<Request> {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('requests')
      .update({ status, ...meta })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw new ConflictError(error.message)
    return data
  }
}
```

---

## Reglas de implementación backend

1. Toda operación de escritura pasa por los 9 pasos. Sin excepciones.
2. El orden importa: validar input → cargar entidades → autorizar → invariantes → ejecutar.
3. Los side effects (schedule, notificaciones, audit) van después de la operación principal.
4. Audit log se escribe siempre, incluso si la notificación falla.
5. Las notificaciones pueden fallar sin revertir la operación principal (son best-effort).
6. `traceId` se propaga a audit log, notificaciones y logs de Sentry.
7. Nunca exponer errores de DB crudos al cliente.
8. Nunca ejecutar lógica de dominio en route handlers — solo recibir, delegar, responder.
