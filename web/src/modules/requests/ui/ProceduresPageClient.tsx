'use client';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { CalendarRange, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';

import { reviewProcedureAction } from '../application/procedureActions';
import type { ProcedureRecord } from '../domain/procedureTypes';
import { ProcedureCreateDialog } from './ProcedureCreateDialog';

type ProceduresPageClientProps = {
  initialProcedures: ProcedureRecord[];
  teamProcedures?: ProcedureRecord[];
  canManageTeam?: boolean;
  currentEmploymentId: string;
};

const columnHelper = createColumnHelper<ProcedureRecord>();

function getStatusIcon(status: string) {
  switch (status) {
    case 'approved':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'rejected':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'in_review':
    case 'requested':
      return <Clock className="w-4 h-4 text-amber-500" />;
    default:
      return <div className="w-4 h-4 rounded-full bg-slate-500" />;
  }
}

function translateType(type: string) {
  const map: Record<string, string> = {
    vacation: 'Vacaciones',
    sick_leave: 'Lic. Médica',
    justified_absence: 'Ausencia Justif.',
    absence: 'Aviso Ausencia',
  };
  return map[type] || type;
}

function ReviewButtons({ procedureId }: { procedureId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleReview = (status: 'approved' | 'rejected') => {
    startTransition(async () => {
      try {
        await reviewProcedureAction({ procedureId, status });
      } catch (e) {
        console.error('Error reviewing procedure:', e);
        alert('Error al revisar el trámite');
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

export function ProceduresPageClient({
  initialProcedures,
  teamProcedures = [],
  canManageTeam = false,
  currentEmploymentId,
}: ProceduresPageClientProps) {
  const [procedures] = useState(initialProcedures);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');

  const columns = useMemo(() => [
    columnHelper.accessor('status', {
      header: 'Estado',
      cell: (info) => {
        const val = info.getValue();
        return (
          <div className="flex items-center gap-2">
            {getStatusIcon(val)}
            <span className="capitalize">{val.replace('_', ' ')}</span>
          </div>
        );
      },
    }),
    columnHelper.accessor('procedure_type', {
      header: 'Tipo',
      cell: (info) => <div className="font-medium text-foreground">{translateType(info.getValue())}</div>,
    }),
    columnHelper.accessor('created_at', {
      header: 'Solicitado El',
      cell: (info) => new Date(info.getValue()).toLocaleDateString(),
    }),
    columnHelper.display({
      id: 'actions',
      cell: (info) => {
        const proc = info.row.original;
        const needsReview = canManageTeam && activeTab === 'team' && (proc.status === 'requested' || proc.status === 'in_review');

        return (
          <div className="flex items-center gap-3">
            <button className="text-sm font-medium text-amber-500 hover:text-amber-400">
              Ver Detalles
            </button>
            {needsReview && <ReviewButtons procedureId={proc.procedure_id} />}
          </div>
        );
      },
    }),
  ], [activeTab, canManageTeam]);

  const displayProcedures = activeTab === 'team' ? teamProcedures : procedures;
  const data = useMemo(() => displayProcedures, [displayProcedures]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Trámites</h1>
          <p className="text-muted mt-2">
            {canManageTeam ? 'Gestiona tus trámites y los de tu equipo.' : 'Gestiona tus solicitudes de licencias, vacaciones y ausencias.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 rounded-full text-amber-500">
            <CalendarRange className="w-6 h-6" />
          </div>
        </div>
      </div>

      {canManageTeam && (
        <div className="flex gap-4 border-b border-border/50 pb-px">
          <button 
            className={`pb-2 px-1 font-medium transition-colors border-b-2 ${activeTab === 'my' ? 'border-amber-500 text-amber-500' : 'border-transparent text-muted-foreground hover:text-white'}`}
            onClick={() => setActiveTab('my')}
          >
            Mis Trámites
          </button>
          <button 
            className={`pb-2 px-1 font-medium transition-colors border-b-2 ${activeTab === 'team' ? 'border-amber-500 text-amber-500' : 'border-transparent text-muted-foreground hover:text-white'}`}
            onClick={() => setActiveTab('team')}
          >
            Trámites del Equipo
          </button>
        </div>
      )}

      <div className="bg-surface border border-border/50 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Historial de Trámites</h2>
          {currentEmploymentId ? (
            <button 
              className="px-4 py-2 bg-amber-500 text-black font-semibold rounded-full hover:bg-amber-400 transition"
              onClick={() => setIsCreateOpen(true)}
            >
              Nuevo Trámite
            </button>
          ) : (
            <span className="text-sm text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
              No tienes un empleo activo asociado
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-background/50 text-muted-foreground">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="py-3 px-5 font-semibold">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
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
                    No tienes trámites registrados.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="hover:bg-background/30 transition-colors">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="py-3 px-5">
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

      <ProcedureCreateDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        employmentId={currentEmploymentId}
      />
    </div>
  );
}
