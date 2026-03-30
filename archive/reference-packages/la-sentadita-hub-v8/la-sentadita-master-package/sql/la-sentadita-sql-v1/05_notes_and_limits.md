# Notes and Limits

## Lo que este paquete sí resuelve
- modelo base del dominio congelado
- enums y tablas principales
- constraints clave de tasks y procedures
- base RLS inicial
- helper functions
- audit helper

## Lo que este paquete deja deliberadamente para una siguiente capa
- políticas RLS completas por scope/restaurant/zone
- prevención dura en DB de solapamientos de horario
- prevención dura en DB de un-restaurante-por-día
- triggers completos de auditoría automática por tabla
- sincronización automática entre procedures/scheduling/tasks
- notificaciones y push workers

## Recomendación de arquitectura
En Supabase:
- usar `service_role` para operaciones críticas de backend
- centralizar lógica de dominio en backend/actions/functions
- no intentar resolver toda la lógica compleja solo con RLS
