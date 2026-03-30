'use server';

import { revalidatePath } from 'next/cache';

import {
  CreateRequestSchema,
  type CreateRequestSchemaType,
  ReviewRequestSchema,
  type ReviewRequestSchemaType,
} from '../domain/requestSchemas';
import { createRequest, reviewRequest } from './requestService';

export async function createRequestAction(data: CreateRequestSchemaType) {
  const parsed = CreateRequestSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Datos de solicitud invalidos: ${parsed.error.message}`);
  }

  await createRequest(parsed.data);

  revalidatePath('/requests');
  revalidatePath('/app');
}

export async function reviewRequestAction(data: ReviewRequestSchemaType) {
  const parsed = ReviewRequestSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Datos de revision invalidos: ${parsed.error.message}`);
  }

  await reviewRequest(parsed.data);

  revalidatePath('/requests');
  revalidatePath('/app');
}
