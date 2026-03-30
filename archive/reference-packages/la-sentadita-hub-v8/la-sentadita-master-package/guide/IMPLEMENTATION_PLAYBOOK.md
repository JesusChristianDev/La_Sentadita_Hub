# Implementation Playbook

## Objetivo
Guiar a un asistente IA o a un desarrollador para implementar La Sentadita Hub sin romper la arquitectura congelada.

## Reglas de trabajo

### 1. Respetar el dominio
Nunca mezclar:
- `system_role`
- `job_title`
- `scope`

### 2. No inventar reglas
Si una regla no existe en los documentos fuente:
- detenerse
- marcar `OPEN QUESTION`

### 3. Backend como fuente de verdad
No colocar lógica crítica en:
- componentes React
- hooks de UI
- formularios

### 4. Auditar operaciones críticas
Toda acción crítica debe generar auditoría.

### 5. Preservar histórico
No reescribir silenciosamente:
- pasado operativo
- tareas completadas
- versiones superseded
- publicaciones históricas

## Orden de implementación recomendado
1. authz
2. audit
3. people
4. employment
5. scheduling
6. tasks
7. procedures
8. shift swaps
9. incidents
10. documents
11. notifications

## Estilo recomendado para módulos
Cada módulo debe tener:
- `domain/`
- `application/`
- `infrastructure/`

## Patrón de caso de uso
1. validar input
2. cargar contexto
3. autorizar
4. cargar entidades
5. validar invariantes
6. ejecutar cambio
7. aplicar side effects
8. escribir auditoría
9. emitir notificaciones
10. devolver resultado

## Errores recomendados
- `AuthorizationError`
- `ValidationError`
- `InvariantViolationError`
- `ConflictError`
- `NotFoundError`
