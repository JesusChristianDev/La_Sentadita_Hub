# La Sentadita Hub — INTENCIÓN v0

## 1) En 1 frase, esto es:
"PWA interna para una cadena de restaurantes para operar el día a día: horarios (draft/publicado), tareas, trámites, documentos, incidencias y horas/reportes, con permisos por rol y auditoría."

## 2) Usuario principal (solo 1)
- Manager de restaurante (rol: manager)

## 3) Problema #1 que sí o sí resolvemos
- Centralizar y controlar la operación semanal (horarios + ejecución + incidencias + horas) con permisos claros y trazabilidad.

## 4) Lo que NO vamos a hacer (3 balas)
- No vamos a integrar AGORA POS (OCR/albaranes/fichajes) en el MVP.
- No vamos a implementar 2FA en el MVP.
- No vamos a construir UI de auditoría en el MVP (se guarda pero no se expone).

## 5) Éxito del MVP (2 métricas)
- Tiempo p95 “draft → publicado” de un horario semanal: ____ minutos.
- p95 “pending → sent” en notificaciones (outbox) < 15 minutos (no bloqueadas por proveedor).
