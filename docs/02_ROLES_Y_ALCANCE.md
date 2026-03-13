# Roles y alcance v0.1

## Roles (auth)
1) employee
2) manager
3) office
4) admin

## Capability adicional (NO es rol)
- area_lead = employee + is_area_lead=true + area=(barra|sala|cocina)

## Precedencia (obligatoria)
admin > office > manager > area_lead > employee

---

## Alcance por restaurante (REGLA CRÍTICA)
- manager NO es global de la cadena: es manager SOLO de su restaurante.
- employee también está ligado a 1 restaurante.
- office y admin son globales (con selector de restaurante).
- No existe "manager global".

### Regla server-side (obligatoria)
- Si role in (employee, manager, area_lead):
  - restaurant_scope = profile.restaurant_id
  - cualquier intento de acceder/operar sobre otro restaurant_id => 403/404 (por política).
- Si role in (office, admin):
  - restaurant_scope = ANY (según selector/param)
  - EXCEPCIÓN: office NO puede ver/gestionar horarios (ver más abajo).

---

## Resumen por rol (1 frase)
- employee: ve solo publicado, sus documentos, sus horas, puede crear solicitudes e incidencias.
- manager: opera SOLO su restaurante; edita draft (todas las zonas) y publica; aprueba step 1 de solicitudes.
- office: global con selector de restaurante; NO ve horarios; sí ve horas solo números; decide step 2 de solicitudes; gestiona documentos.
- admin: global; puede forzar/controlar todo y resolver incidencias del sistema.

---

## Restricción clave (del spec)
- office no ve ni gestiona horarios (ni editor, ni PDF, ni rangos). Solo “números” de horas.

Implementación obligatoria (server-side):
- Bloquear cualquier ruta /schedule/* a role=office (403/404).
- Endpoints de horas para office devuelven solo agregados numéricos (sin rangos ni detalle que permita reconstruir turnos).

---

## Qué puede ver un empleado normal
- Puede ver: horario publicado, sus tareas asignadas, sus solicitudes, documentos propios, anuncios/normas aplicables, sus horas.
- No puede ver: draft, datos sensibles de otros empleados, reportes globales.

---

## ¿Hay manager global multi-restaurante?
- No. (office/admin son globales con selector; manager/employee están ligados a 1 restaurante)
