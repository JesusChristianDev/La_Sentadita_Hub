'use server';

import { revalidatePath } from 'next/cache';

import { CreateProcedureSchema, type CreateProcedureSchemaType, ReviewProcedureSchema, type ReviewProcedureSchemaType } from '../domain/procedureSchemas';
import { createProcedure, reviewProcedure } from './procedureService';

export async function createProcedureAction(data: CreateProcedureSchemaType) {
  const parsed = CreateProcedureSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('Datos de trámite inválidos: ' + parsed.error.message);
  }

  await createProcedure(parsed.data);
  
  revalidatePath('/procedures');
  revalidatePath('/app');
}

export async function reviewProcedureAction(data: ReviewProcedureSchemaType) {
  const parsed = ReviewProcedureSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('Datos de revisión inválidos: ' + parsed.error.message);
  }

  await reviewProcedure(parsed.data);
  
  revalidatePath('/procedures');
  revalidatePath('/app');
}
