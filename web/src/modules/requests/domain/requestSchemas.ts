import { z } from 'zod';

export const RequestTypeSchema = z.enum([
  'vacation',
  'sick_leave',
  'justified_absence',
  'absence',
]);

export const CreateRequestSchema = z.object({
  employmentId: z.string().min(1, 'El contrato/empleo es requerido'),
  requestType: RequestTypeSchema,
  effectiveStartDate: z.string().optional().nullable(),
  effectiveEndDate: z.string().optional().nullable(),
});

export type CreateRequestSchemaType = z.infer<typeof CreateRequestSchema>;

export const ReviewRequestSchema = z.object({
  requestId: z.string().min(1, 'El ID de la solicitud es requerido'),
  resolutionNote: z.string().optional().nullable(),
  status: z.enum([
    'approved',
    'rejected',
    'cancelled',
    'expired',
    'reported',
    'validated',
    'closed',
    'in_review',
    'resolved',
  ]),
});

export type ReviewRequestSchemaType = z.infer<typeof ReviewRequestSchema>;
