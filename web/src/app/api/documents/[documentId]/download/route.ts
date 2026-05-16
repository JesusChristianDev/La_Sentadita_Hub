import { jsonError } from '@/app/api/_routeUtils';
import { resolveRouteParams } from '@/app/api/_routeUtils';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { AUDIT_ACTIONS, writeAuditLog } from '@/modules/audit';
import { getCurrentUserContext } from '@/modules/auth_users';
import { getDocument } from '@/modules/documents/application/documentService';

const BUCKET = 'documents';
const SIGNED_URL_EXPIRES_IN_SECONDS = 300; // 5-minute short-lived URL for download

// Returns true if the file_url looks like a Supabase Storage path (no protocol)
function isStoragePath(fileUrl: string): boolean {
  return !fileUrl.startsWith('http://') && !fileUrl.startsWith('https://');
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    return jsonError('UNAUTHORIZED', 401);
  }

  const { documentId } = await resolveRouteParams(context.params);

  let document;
  try {
    // getDocument already validates access and logs documentViewed
    document = await getDocument(documentId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Not found';
    if (message.includes('FORBIDDEN')) return jsonError('FORBIDDEN', 403);
    return jsonError('NOT_FOUND', 404);
  }

  // Log the download event (distinct from "viewed" — this is the actual file access)
  await writeAuditLog({
    action: AUDIT_ACTIONS.documentDownloaded,
    entityId: documentId,
    entityType: 'document',
    scopeId: null,
    scopeType: null,
    traceId: ctx.requestContext.traceId,
  });

  const { file_url } = document;

  // If it's a storage path: generate a short-lived signed URL and redirect
  if (isStoragePath(file_url)) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(file_url, SIGNED_URL_EXPIRES_IN_SECONDS);

    if (error || !data) {
      return jsonError('SIGNED_URL_FAILED', 500);
    }

    return Response.redirect(data.signedUrl, 302);
  }

  // Legacy absolute URL: redirect directly
  return Response.redirect(file_url, 302);
}
