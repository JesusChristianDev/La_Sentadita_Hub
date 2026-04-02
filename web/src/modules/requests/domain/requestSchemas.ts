import { z } from 'zod';

const nullableDateString = z.preprocess(
  (value) => {
    if (value === '' || value === undefined) return null;
    return value;
  },
  z.string().date().nullable(),
);

export const RequestTypeSchema = z.enum([
  'vacation',
  'sick_leave',
  'justified_absence',
  'absence',
]);

export const CreateRequestSchema = z.object({
  employmentId: z.string().min(1, 'El contrato/empleo es requerido'),
  requestType: RequestTypeSchema,
  effectiveStartDate: nullableDateString.optional().nullable(),
  effectiveEndDate: nullableDateString.optional().nullable(),
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
    'in_review',
  ]),
});

export type ReviewRequestSchemaType = z.infer<typeof ReviewRequestSchema>;
