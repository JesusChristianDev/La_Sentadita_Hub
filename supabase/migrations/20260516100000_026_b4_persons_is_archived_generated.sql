-- Migration 026: B.4 — persons.is_archived como columna generada
--
-- Decisión D-027: access_status = 'archived' es la única fuente de verdad.
-- is_archived era un campo redundante que debía mantenerse sincronizado
-- manualmente, creando riesgo de inconsistencia.
--
-- Solución: reemplazar la columna booleana por una columna GENERATED ALWAYS AS.
-- Las lecturas existentes (person.is_archived) siguen funcionando sin cambios.
-- Las escrituras a is_archived dejan de ser necesarias (el DB las deriva de access_status).

-- 1. Garantizar consistencia antes de cambiar el esquema
UPDATE public.persons
   SET access_status = 'archived'
 WHERE is_archived = true
   AND (access_status IS NULL OR access_status <> 'archived');

UPDATE public.persons
   SET access_status = 'active'
 WHERE is_archived = false
   AND access_status IS NULL;

-- 2. Reemplazar columna manual por columna generada
ALTER TABLE public.persons DROP COLUMN is_archived;

ALTER TABLE public.persons
  ADD COLUMN is_archived boolean
  GENERATED ALWAYS AS (access_status IS NOT DISTINCT FROM 'archived') STORED NOT NULL;
