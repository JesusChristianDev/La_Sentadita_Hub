import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import type { WriteAuditLogInput } from '../domain/auditActions';

export type WriteAuditLogResult =
  | { status: 'success' }
  | { reason: 'insert_audit_log_missing'; status: 'unavailable' }
  | { error: string; status: 'error' };

function isMissingRpcError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;

  return (
    error.code === '42883' ||
    error.message?.includes('insert_audit_log') === true ||
    error.message?.includes('Could not find the function') === true ||
    error.message?.includes('does not exist') === true
  );
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Unknown audit error';
}

export async function writeAuditLog(
  input: WriteAuditLogInput,
): Promise<WriteAuditLogResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc('insert_audit_log', {
      p_action: input.action,
      p_entity_id: input.entityId,
      p_entity_type: input.entityType,
      p_new_value: input.newValue ?? null,
      p_previous_value: input.previousValue ?? null,
      p_reason: input.reason ?? null,
      p_scope_id: input.scopeId ?? null,
      p_scope_type: input.scopeType ?? null,
      p_trace_id: input.traceId ?? null,
    });

    if (!error) {
      return { status: 'success' };
    }

    if (isMissingRpcError(error)) {
      return { reason: 'insert_audit_log_missing', status: 'unavailable' };
    }

    return { error: formatError(error), status: 'error' };
  } catch (error) {
    return { error: formatError(error), status: 'error' };
  }
}
