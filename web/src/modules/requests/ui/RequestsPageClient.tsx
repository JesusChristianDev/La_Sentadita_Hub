'use client';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useState, useTransition } from 'react';

import { reviewRequestAction } from '../application/requestActions';
import type { RequestRecord } from '../domain/requestTypes';
import { RequestCreateDialog } from './RequestCreateDialog';

const coreRowModel = getCoreRowModel();

type RequestsPageClientProps = {
  currentEmploymentId: string;
  initialRequests: RequestRecord[];
  mode: 'context_required' | 'self_service' | 'team_workspace' | 'team_scope_overview';
  teamRequests?: RequestRecord[];
};

const columnHelper = createColumnHelper<RequestRecord>();

function getStatusIcon(status: string) {
  switch (status) {
    case 'approved':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'rejected':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'in_review':
    case 'pending':
      return <Clock className="h-4 w-4 text-amber-500" />;
    default:
      return <div className="h-4 w-4 rounded-full bg-slate-500" />;
  }
}

function translateType(type: string) {
  const map: Record<string, string> = {
    absence: 'Aviso de ausencia',
    justified_absence: 'Ausencia justificada',
    sick_leave: 'Baja medica',
    vacation: 'Vacaciones',
  };
  return map[type] || type;
}

function ReviewButtons({ requestId }: { requestId: string }) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleReview = (status: 'approved' | 'rejected') => {
    startTransition(async () => {
      try {
        await reviewRequestAction({ requestId, status });
      } catch (error) {
        console.error('Error reviewing request:', error);
        setErrorMsg('Error al revisar la solicitud');
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <button
        disabled={isPending}
        className="text-sm font-medium text-green-500 hover:text-green-400 disabled:opacity-50"
        onClick={() => handleReview('approved')}
      >
        Aprobar
      </button>
      <button
        disabled={isPending}
        className="text-sm font-medium text-red-500 hover:text-red-400 disabled:opacity-50"
        onClick={() => handleReview('rejected')}
      >
        Rechazar
      </button>
      {errorMsg ? (
        <span className="text-xs text-red-400">{errorMsg}</span>
      ) : null}
    </div>
  );
}

export function RequestsPageClient({
  currentEmploymentId,
  initialRequests,
  mode,
  teamRequests = [],
}: RequestsPageClientProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');

  const canManageTeam =
    mode === 'team_workspace' || mode === 'context_required' || mode === 'team_scope_overview';
  const canReviewTeam = mode === 'team_workspace';
  const isTeamTabDisabled = mode === 'context_required' || mode === 'team_scope_overview';

  const columns = [
    columnHelper.accessor('status', {
      header: 'Estado',
      cell: (info) => {
        const value = info.getValue();
        return (
          <div className="flex items-center gap-2">
            {getStatusIcon(value)}
            <span className="capitalize">{value.replace('_', ' ')}</span>
          </div>
        );
      },
    }),
    columnHelper.accessor('request_type', {
      header: 'Tipo',
      cell: (info) => (
        <div className="font-medium text-foreground">{translateType(info.getValue())}</div>
      ),
    }),
    columnHelper.accessor('created_at', {
      header: 'Solicitada el',
      cell: (info) => new Date(info.getValue()).toLocaleDateString(),
    }),
    columnHelper.display({
      id: 'actions',
      cell: (info) => {
        const request = info.row.original;
        const needsReview =
          canReviewTeam &&
          activeTab === 'team' &&
          (request.status === 'pending' || request.status === 'in_review');

        return (
          <div className="flex items-center gap-3">
            <button className="text-sm font-medium text-amber-500 hover:text-amber-400">
              Ver detalles
            </button>
            {needsReview ? <ReviewButtons requestId={request.request_id} /> : null}
          </div>
        );
      },
    }),
  ];

  const displayRequests = activeTab === 'team' && canReviewTeam ? teamRequests : initialRequests;

  const table = useReactTable({
    data: displayRequests,
    columns,
    getCoreRowModel: coreRowModel,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {mode === 'context_required' ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Puedes revisar tus propias solicitudes, pero la bandeja de equipo necesita
            una sucursal activa para evitar mezclar datos de distintos restaurantes.
          </p>
        </div>
      ) : null}

      {mode === 'team_scope_overview' ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Estas en un scope global (organizacion/empresa). La vista agregada de equipo aun no
            muestra datos consolidados, pero puedes gestionar tus propias solicitudes sin elegir
            un restaurante concreto.
          </p>
        </div>
      ) : null}

      {canManageTeam ? (
        <div className="border-b border-border/50 pb-px">
          <div className="flex gap-4">
            <button
              className={`border-b-2 px-1 pb-2 font-medium transition-colors ${activeTab === 'my' ? 'border-amber-500 text-amber-500' : 'border-transparent text-muted hover:text-white'}`}
              onClick={() => setActiveTab('my')}
            >
              Mis solicitudes
            </button>
            <button
              className={`border-b-2 px-1 pb-2 font-medium transition-colors ${activeTab === 'team' ? 'border-amber-500 text-amber-500' : 'border-transparent text-muted hover:text-white'} ${isTeamTabDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
              disabled={isTeamTabDisabled}
              onClick={() => setActiveTab('team')}
            >
              Solicitudes del equipo
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border/50 bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border/50 p-5">
          <h2 className="text-xl font-semibold text-white">Historial de solicitudes</h2>
          {currentEmploymentId ? (
            <button
              className="rounded-full bg-amber-500 px-4 py-2 font-semibold text-black transition hover:bg-amber-400"
              onClick={() => setIsCreateOpen(true)}
            >
              Nueva solicitud
            </button>
          ) : (
            <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-sm text-red-400">
              No tienes un empleo activo asociado
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-background/50 text-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-5 py-3 font-semibold">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-border/50">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-8 text-center text-muted">
                    {activeTab === 'team' && isTeamTabDisabled
                      ? 'La vista de equipo requiere un restaurante o zona especifica. Cambia el scope si necesitas mas detalle.'
                      : 'No hay solicitudes registradas.'}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-background/30">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-5 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RequestCreateDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        employmentId={currentEmploymentId}
      />
    </div>
  );
}
