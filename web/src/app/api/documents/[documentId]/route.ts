import { z } from 'zod';

import { jsonOk, parseJsonBody, resolveRouteParams } from '@/app/api/_routeUtils';
import {
  archiveDocument,
  type CreateDocumentInput,
  getDocument,
  supersedeDocument,
} from '@/modules/documents';

const documentInputSchema = z.object({
  documentType: z.enum([
    'employment_contract',
    'contract_addendum',
    'payroll',
    'identity_document',
    'medical_certificate',
    'absence_justification',
    'policy_document',
    'internal_report',
    'delivery_note',
  ]),
  fileUrl: z.string().trim().min(1),
  ownerId: z.string().uuid(),
  ownerType: z.enum([
    'person',
    'employment_relationship',
    'request',
    'restaurant',
    'delivery_note',
  ]),
  requiresReauth: z.boolean().optional(),
  visibility: z.enum([
    'employee_visible',
    'management_visible',
    'restricted_management',
    'administrative_only',
  ]),
});

type RouteParams = {
  documentId: string;
};

export async function GET(
  _request: Request,
  context: { params: RouteParams | Promise<RouteParams> },
) {
  const params = await resolveRouteParams(context.params);
  const document = await getDocument(params.documentId);
  return jsonOk({ document });
}

export async function PATCH(
  _request: Request,
  context: { params: RouteParams | Promise<RouteParams> },
) {
  const params = await resolveRouteParams(context.params);
  const document = await archiveDocument(params.documentId);
  return jsonOk({ document });
}

export async function POST(
  request: Request,
  context: { params: RouteParams | Promise<RouteParams> },
) {
  const params = await resolveRouteParams(context.params);
  const body = await parseJsonBody<CreateDocumentInput>(request, documentInputSchema);
  const result = await supersedeDocument(params.documentId, body);
  return jsonOk(result);
}
