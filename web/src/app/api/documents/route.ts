import { z } from 'zod';

import {
  createDocument,
  type CreateDocumentInput,
  listAccessibleDocuments,
} from '@/modules/documents';

import { jsonOk, parseJsonBody } from '../_routeUtils';

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

export async function GET() {
  const documents = await listAccessibleDocuments();
  return jsonOk({ documents });
}

export async function POST(request: Request) {
  const body = await parseJsonBody<CreateDocumentInput>(request, documentInputSchema);
  const document = await createDocument(body);
  return jsonOk({ document }, { status: 201 });
}
