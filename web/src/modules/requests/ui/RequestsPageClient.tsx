'use client';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { CalendarRange, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useState, useTransition } from 'react';

import { reviewRequestAction } from '../application/requestActions';
import type { RequestRecord } from '../domain/requestTypes';
import { RequestCreateDialog } from './RequestCreateDialog';

type RequestsPageClientProps = {
  initialRequests: RequestRecord[];
  teamRequests?: RequestRecord[];
  canManageTeam?: boolean;
  currentEmploymentId: string;
};

const columnHelper = createColumnHelper<RequestRecord>();

function getStatusIcon(status: string) {
  switch (status) {
    case 'approved':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'rejected':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'in_review':
    case 'requested':
      return <Clock className="h-4 w-4 text-amber-500" />;
    default:
      return <div className="h-4 w-4 rounded-full bg-slate-500" />;
  }
}

function translateType(type: string) {
  const map: Record<string, string> = {
    vacation: 'Vacaciones',
    sick_leave: 'Baja medica',
    justified_absence: 'Ausencia justificada',
    absence: 'Aviso de ausencia',
  };
  return map[type] || type;
}

function ReviewButtons({ requestId }: { requestId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleReview = (status: 'approved' | 'rejected') => {
    startTransition(async () => {
      try {
        await reviewRequestAction({ requestId, status });
      } catch (error) {
        console.error('Error reviewing request:', error);
        alert('Error al revisar la solicitud');
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
    </div>
  );
}

export function RequestsPageClient({
  initialRequests,
  teamRequests = [],
  canManageTeam = false,
  currentEmploymentId,
}: RequestsPageClientProps) {
  const [requests] = useState(initialRequests);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');

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
          canManageTeam &&
          activeTab === 'team' &&
          (request.status === 'requested' || request.status === 'in_review');

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

  const displayRequests = activeTab === 'team' ? teamRequests : requests;
  const table = useReactTable({
    data: displayRequests,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Solicitudes</h1>
          <p className="mt-2 text-muted">
            {canManageTeam
              ? 'Gestiona tus solicitudes y las de tu equipo.'
              : 'Gestiona tus solicitudes laborales y operativas.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-amber-500/10 p-3 text-amber-500">
            <CalendarRange className="h-6 w-6" />
          </div>
        </div>
      </div>

      {canManageTeam ? (
        <div className="border-b border-border/50 pb-px">
          <div className="flex gap-4">
            <button
              className={`border-b-2 px-1 pb-2 font-medium transition-colors ${activeTab === 'my' ? 'border-amber-500 text-amber-500' : 'border-transparent text-muted-foreground hover:text-white'}`}
              onClick={() => setActiveTab('my')}
            >
              Mis solicitudes
            </button>
            <button
              className={`border-b-2 px-1 pb-2 font-medium transition-colors ${activeTab === 'team' ? 'border-amber-500 text-amber-500' : 'border-transparent text-muted-foreground hover:text-white'}`}
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
            <thead className="bg-background/50 text-muted-foreground">
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
                    No hay solicitudes registradas.
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
