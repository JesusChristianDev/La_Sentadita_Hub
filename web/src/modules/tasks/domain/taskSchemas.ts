import { z } from 'zod';

export const CreateTaskInstanceSchema = z.object({
  restaurantId: z.string().uuid(),
  taskDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Debe tener formato YYYY-MM-DD'),
  taskTemplateId: z.string().uuid().optional().nullable(),
  assignedEmployeeId: z.string().uuid().optional().nullable(),
  assignedRole: z.string().optional().nullable(),
  assignedZoneId: z.string().uuid().optional().nullable(),
  shiftContext: z.string().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  requiresConfirmation: z.boolean().optional().default(false),
}).refine(
  (data) => data.assignedEmployeeId || data.assignedRole || data.assignedZoneId,
  {
    message: 'Toda tarea debe nacer con al menos un responsable.',
    path: ['assignedEmployeeId'], // attach error to assignedEmployeeId for display
  }
);

export type CreateTaskInstanceSchemaType = z.infer<typeof CreateTaskInstanceSchema>;

export const ReassignTaskInstanceSchema = z.object({
  taskInstanceId: z.string().uuid(),
  assignedEmployeeId: z.string().uuid().optional().nullable(),
  assignedRole: z.string().optional().nullable(),
  assignedZoneId: z.string().uuid().optional().nullable(),
  reason: z.enum(['employment_change', 'request_conflict', 'shift_swap', 'manual_reassignment_required']),
}).refine(
  (data) => data.assignedEmployeeId || data.assignedRole || data.assignedZoneId,
  {
    message: 'Toda reasignación debe tener al menos un responsable.',
    path: ['assignedEmployeeId'],
  }
);

export type ReassignTaskInstanceSchemaType = z.infer<typeof ReassignTaskInstanceSchema>;
