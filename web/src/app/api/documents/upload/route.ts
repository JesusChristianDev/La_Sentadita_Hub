import { jsonError, jsonOk } from '@/app/api/_routeUtils';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserContext } from '@/modules/auth_users';

const BUCKET = 'documents';
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

// Signed URL valid for 1 hour — document service should store the storage path, not this URL
const SIGNED_URL_EXPIRES_IN_SECONDS = 3600;

export async function POST(request: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    return jsonError('UNAUTHORIZED', 401);
  }

  // Only managers, office, admin, and owner can upload documents
  const { systemRole } = ctx.requestContext;
  if (
    systemRole === 'employee' ||
    systemRole === 'area_lead'
  ) {
    // Employees can only upload their own documents (e.g., medical certificates)
    // This is enforced via ownerType/ownerId validation on the document creation side.
    // We allow the upload but restrict what owner types they can use.
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('INVALID_FORM_DATA', 400);
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return jsonError('MISSING_FILE', 400, { message: 'Se requiere un archivo en el campo "file".' });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return jsonError('INVALID_FILE_TYPE', 400, {
      allowed: [...ALLOWED_MIME_TYPES],
      message: `Tipo de archivo no soportado: ${file.type}`,
    });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return jsonError('FILE_TOO_LARGE', 400, {
      maxBytes: MAX_FILE_SIZE_BYTES,
      message: 'El archivo supera el límite de 20 MB.',
    });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Path: {userId}/{timestamp}-{sanitized filename}
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const storagePath = `${ctx.userId}/${Date.now()}-${sanitizedName}`;

  const admin = createSupabaseAdminClient();

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('[document-upload] Storage error:', uploadError.message);
    return jsonError('UPLOAD_FAILED', 500, { message: uploadError.message });
  }

  // Generate a signed URL valid for 1 hour
  const { data: signedData, error: signedError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN_SECONDS);

  if (signedError || !signedData) {
    console.error('[document-upload] Signed URL error:', signedError?.message);
    return jsonError('SIGNED_URL_FAILED', 500);
  }

  return jsonOk(
    {
      contentType: file.type,
      signedUrl: signedData.signedUrl,
      storagePath,
    },
    { status: 201 },
  );
}
