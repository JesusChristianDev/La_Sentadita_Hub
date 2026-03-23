# 01 — System Overview

## Qué es La Sentadita Hub
La Sentadita Hub es una plataforma interna para gestionar la operación de una cadena de restaurantes. Centraliza personas, horarios, tareas, incidencias, trámites, documentos, notificaciones y auditoría.

## Problema que resuelve
Sustituye coordinación informal y fragmentada:
- papel
- WhatsApp
- mensajes verbales
- archivos dispersos

por un sistema:
- centralizado
- trazable
- auditable
- modular

## Módulos núcleo
1. People / Employment
2. Scheduling
3. Tasks
4. Procedures
5. Incidents
6. Documents
7. Notifications
8. Audit

## Principios de diseño
- El restaurante es la unidad operativa.
- La empresa (`company`) es la unidad legal.
- La persona y la relación laboral no son lo mismo.
- Los cambios críticos generan auditoría.
- La planificación publicada es la verdad oficial para el empleado.
- Los procedimientos aprobados pueden sobrescribir automáticamente el horario.
- La seguridad y la visibilidad siempre dependen de rol + scope + acción.
