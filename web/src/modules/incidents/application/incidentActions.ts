'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  assignIncidentOwner,
  createIncident,
  editIncidentDetails,
  updateIncidentStatus,
} from './incidentService';

const INCIDENT_CATEGORIES = [
  'operational',
  'maintenance',
  'hygiene',
  'customer',
  'security',
  'stock',
  'technology',
  'personnel',
] as const;

const categoryEnum = z.enum(INCIDENT_CATEGORIES);

const createIncidentSchema = z.object({
  category: categoryEnum,
  description: z.string().trim().min(1),
  restaurantId: z.string().uuid(),
  sensitivity: z.enum(['normal', 'restricted']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).nullable().optional(),
  title: z.string().trim().min(1),
  zoneId: z.string().uuid().optional().nullable(),
});

const incidentStatusSchema = z.object({
  incidentId: z.string().uuid(),
  status: z.enum(['reported', 'in_review', 'resolved', 'closed']),
});

const editIncidentDetailsSchema = z.object({
  incidentId: z.string().uuid(),
  category: categoryEnum.optional(),
  description: z.string().trim().min(1).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).nullable().optional(),
  title: z.string().trim().min(1).optional(),
});

const incidentOwnerSchema = z.object({
  incidentId: z.string().uuid(),
  ownerPersonId: z.string().uuid().optional().nullable(),
});

export async function createIncidentAction(formData: FormData) {
  const parsed = createIncidentSchema.safeParse({
    category: formData.get('category'),
    description: formData.get('description'),
    restaurantId: formData.get('restaurantId'),
    sensitivity: formData.get('sensitivity') || undefined,
    severity: formData.get('severity') || undefined,
    title: formData.get('title'),
    zoneId: formData.get('zoneId') || undefined,
  });

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.message };
  }

  try {
    await createIncident(parsed.data);
    revalidatePath('/incidents');
    revalidatePath('/app');
    return { ok: true as const };
  } catch (error: unknown) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'No se pudo crear la incidencia',
    };
  }
}

export async function updateIncidentStatusAction(formData: FormData) {
  const parsed = incidentStatusSchema.safeParse({
    incidentId: formData.get('incidentId'),
    status: formData.get('status'),
  });

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.message };
  }

  try {
    await updateIncidentStatus(parsed.data.incidentId, parsed.data.status);
    revalidatePath('/incidents');
    revalidatePath('/app');
    return { ok: true as const };
  } catch (error: unknown) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'No se pudo actualizar la incidencia',
    };
  }
}

export async function editIncidentDetailsAction(formData: FormData) {
  const rawSeverity = formData.get('severity');
  const parsed = editIncidentDetailsSchema.safeParse({
    incidentId: formData.get('incidentId'),
    category: formData.get('category') || undefined,
    description: formData.get('description') || undefined,
    severity: rawSeverity === '' ? null : (rawSeverity || undefined),
    title: formData.get('title') || undefined,
  });

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.message };
  }

  const { incidentId, ...rest } = parsed.data;

  try {
    await editIncidentDetails(incidentId, rest);
    revalidatePath('/incidents');
    revalidatePath('/app');
    return { ok: true as const };
  } catch (error: unknown) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'No se pudo editar la incidencia',
    };
  }
}

export async function assignIncidentOwnerAction(formData: FormData) {
  const parsed = incidentOwnerSchema.safeParse({
    incidentId: formData.get('incidentId'),
    ownerPersonId: formData.get('ownerPersonId') || undefined,
  });

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.message };
  }

  if (!parsed.data.ownerPersonId) {
    return { ok: false as const, error: 'El responsable es obligatorio' };
  }

  try {
    await assignIncidentOwner(parsed.data.incidentId, parsed.data.ownerPersonId);
    revalidatePath('/incidents');
    revalidatePath('/app');
    return { ok: true as const };
  } catch (error: unknown) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'No se pudo asignar el responsable',
    };
  }
}
