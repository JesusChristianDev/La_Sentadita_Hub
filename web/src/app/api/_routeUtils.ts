import type { ZodType } from 'zod';

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return Response.json(data, init);
}

export function jsonError(
  code: string,
  status = 400,
  details?: Record<string, unknown>,
) {
  return Response.json(
    {
      error: code,
      ...(details ? { details } : {}),
    },
    { status },
  );
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  const body = await request.json();
  return schema.parse(body);
}

export async function resolveRouteParams<T extends Record<string, string>>(
  params: T | Promise<T>,
): Promise<T> {
  return await params;
}

export function readBooleanSearchParam(
  searchParams: URLSearchParams,
  key: string,
): boolean | undefined {
  const value = searchParams.get(key);
  if (value === null) {
    return undefined;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return undefined;
}

export function readIntSearchParam(
  searchParams: URLSearchParams,
  key: string,
): number | undefined {
  const value = searchParams.get(key);
  if (value === null || value.trim() === '') {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}
