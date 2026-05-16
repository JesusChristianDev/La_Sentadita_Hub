'use server';

import { revalidatePath } from 'next/cache';

import {
  CreateRequestSchema,
  type CreateRequestSchemaType,
  ReviewRequestSchema,
  type ReviewRequestSchemaType,
} from '../domain/requestSchemas';
import {
  cancelRequest,
  cancelShiftSwapRequest,
  createRequest,
  reviewRequest,
} from './requestService';

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

export async function cancelRequestAction(requestId: string) {
  if (!requestId) throw new Error('requestId requerido');
  await cancelRequest(requestId);
  revalidatePath('/requests');
  revalidatePath('/app');
}

export async function cancelShiftSwapAction(shiftSwapRequestId: string) {
  if (!shiftSwapRequestId) throw new Error('shiftSwapRequestId requerido');
  await cancelShiftSwapRequest(shiftSwapRequestId);
  revalidatePath('/requests');
  revalidatePath('/app');
}

