import { z } from 'zod';

export const ProcedureTypeSchema = z.enum([
  'vacation',
  'sick_leave',
  'justified_absence',
  'absence',
]);

export const CreateProcedureSchema = z.object({
  employmentId: z.string().min(1, 'El contrato/empleo es requerido'),
  procedureType: ProcedureTypeSchema,
  effectiveStartDate: z.string().optional().nullable(),
  effectiveEndDate: z.string().optional().nullable(),
});

export type CreateProcedureSchemaType = z.infer<typeof CreateProcedureSchema>;

export const ReviewProcedureSchema = z.object({
  procedureId: z.string().min(1, 'El ID del trámite es requerido'),
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
    'resolved'
  ]),
});

export type ReviewProcedureSchemaType = z.infer<typeof ReviewProcedureSchema>;
