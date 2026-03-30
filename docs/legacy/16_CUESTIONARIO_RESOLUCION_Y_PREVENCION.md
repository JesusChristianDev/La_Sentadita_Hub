# Cuestionario de Resolucion y Prevencion de Riesgos

Fecha: 2026-02-12  
Repositorio: `C:\la-sentadita-hub`

## 1) Objetivo
Usar este cuestionario para:
- Resolver hallazgos actuales.
- Detectar problemas futuros antes de que lleguen a produccion.
- Priorizar trabajo con una formula unica de riesgo.

## 2) Instrucciones de uso
Para cada pregunta registrar:
- Respuesta (`Si` / `No` / `Parcial`).
- Evidencia (archivo, query, captura o log).
- Dueño.
- Fecha compromiso.
- Puntajes: Impacto, Probabilidad, Detectabilidad.

Escala sugerida por puntaje:
- 1 = bajo
- 3 = medio
- 5 = alto

Formula:
- `Riesgo = Impacto x Probabilidad x Detectabilidad`

Prioridad por resultado:
- `>= 60`: Critico (resolver primero)
- `30-59`: Alto (siguiente bloque)
- `10-29`: Medio (planificado)
- `< 10`: Bajo (monitorear)

Nota sobre Detectabilidad:
- 1 = se detecta facil y temprano
- 5 = dificil de detectar hasta que explota en produccion

## 3) Cuestionario

### A. Consistencia Auth/Profile (Prioridad maxima)
1. Existe un flujo unico documentado para `create/update/delete` entre Auth y `profiles`?
Parcial, solo me faltaria un documento tipo readme.md especializado para el modulo empleados, pero en si el codigo esta albergado en un unico modulo.
2. Cada operacion define compensacion explicita si falla el segundo paso?
3. Hay idempotencia para reintentos seguros?
4. Se registra `traceId` para reconstruir fallos?
5. Existen pruebas de fallo parcial (falla Auth / falla profiles / timeout)?

### B. Login y escalabilidad
6. El estado de usuario desactivado se resuelve por consulta directa indexada (sin escaneo paginado)?
7. El sistema diferencia correctamente `credenciales invalidas` vs `usuario desactivado`?
8. Hay limite de costo por intento de login (tiempo y numero de queries)?
9. Existe proteccion anti abuso (rate limit / lockout progresivo)?
10. Se mide tasa de fallos de login por causa?

### C. Contrato de roles
11. Hay una sola fuente de verdad para roles (codigo + SQL + docs)?
12. `sub_manager` esta formalmente definido con permisos y restricciones?
13. Existe matriz rol->accion aprobada por negocio?
14. Los guards server-side estan alineados con la matriz?
15. Hay test que falle si se agrega un rol sin actualizar contrato?

### D. Brecha MUST vs implementado
16. Esta definido el primer vertical MUST end-to-end con owner y fecha?
17. Cada modulo MUST tiene Definition of Done funcional y tecnica?
18. Se mapearon dependencias entre modulos MUST?
19. Existe roadmap por hitos con fechas realistas?
20. Se evita abrir UI sin dominio, validaciones y guards listos?

### E. DRY y mantenibilidad
21. Validadores (`email`, `password`, `role`) estan centralizados?
22. Utilidades duplicadas tienen plan de consolidacion?
23. La revision de PR bloquea nueva duplicacion evitable?
24. Las responsabilidades por capa (`app`, `modules`, `shared`) estan claras?
25. Existe checklist de refactor minimo por bloque?

### F. Seguridad y prevencion futura
26. Las rutas API publicas usan allowlist explicita (no prefijo amplio)?
27. Cada endpoint tiene politica auth/autz documentada y validada?
28. Se revisan headers criticos por tipo de ruta (`cache-control`, etc.)?
29. Hay auditoria periodica de permisos por rol?
30. Existe plan de respuesta ante incidente (responsable, SLA, pasos)?

### G. Calidad operativa continua
31. Hay pruebas minimas para flujos criticos (auth, empleados, permisos)?
32. Errores de produccion incluyen contexto util para diagnostico?
33. Existen KPIs tecnicos acordados (errores, latencia, regresiones)?
34. Cada entrega exige `lint + build + evidencia funcional`?
35. README y docs se actualizan cuando cambia un contrato?

## 4) Plantilla de scoring (copiar/pegar)
| ID | Pregunta | Estado (Si/No/Parcial) | Evidencia | Dueño | Fecha | Impacto (1-5) | Probabilidad (1-5) | Detectabilidad (1-5) | Riesgo (I x P x D) | Prioridad | Accion |
|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| A1 | Flujo unico Auth/Profile documentado |  |  |  |  |  |  |  |  |  |  |
| A2 | Compensacion explicita por fallo parcial |  |  |  |  |  |  |  |  |  |  |
| A3 | Idempotencia en operaciones criticas |  |  |  |  |  |  |  |  |  |  |
| ... | ... |  |  |  |  |  |  |  |  |  |  |

## 5) Salida esperada de la sesion
- Top 5 riesgos ordenados por puntaje.
- Acciones concretas por riesgo (una accion dueña, con fecha).
- Riesgos bloqueados por decisiones de negocio (si aplica).
- Fecha de reevaluacion del cuestionario.

## 6) Cadencia recomendada
- Al inicio de cada bloque.
- Antes de abrir un modulo MUST nuevo.
- Antes de release relevante.

