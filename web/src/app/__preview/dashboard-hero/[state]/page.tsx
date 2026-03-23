import { notFound } from 'next/navigation';

import { serverEnv } from '@/shared/env.server';

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
  if (process.env.NODE_ENV === 'production' && !serverEnv.allowUiPreview) {
    notFound();
  }

  const { state } = await params;
  if (!previewStates.has(state as DashboardHeroPreviewState)) {
    notFound();
  }

  return <DashboardHeroPreviewPage state={state as DashboardHeroPreviewState} />;
}
