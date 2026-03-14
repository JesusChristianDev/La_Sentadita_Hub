import { notFound } from 'next/navigation';

import {
  DashboardHeroPreviewPage,
  type DashboardHeroPreviewState,
} from './preview-client';

const previewStates = new Set<DashboardHeroPreviewState>([
  'error',
  'idle',
  'loading',
  'partial',
  'success',
]);

export default async function DashboardHeroPreviewRoute({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_UI_PREVIEW !== '1'
  ) {
    notFound();
  }

  const { state } = await params;
  if (!previewStates.has(state as DashboardHeroPreviewState)) {
    notFound();
  }

  return <DashboardHeroPreviewPage state={state as DashboardHeroPreviewState} />;
}
