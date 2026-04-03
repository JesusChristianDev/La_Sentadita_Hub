'use client';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { FrontendPageMode } from '@/modules/auth_users';

import type { TaskInstanceRecord } from '../domain/taskTypes';
import { TaskCreateDialog } from './TaskCreateDialog';

type TasksPageClientProps = {
  initialTasks: TaskInstanceRecord[];
  canManage: boolean;
  mode: Extract<
    FrontendPageMode,
    'restaurant_workspace' | 'self_service' | 'zone_workspace' | 'global_overview'
  >;
  restaurantId: string;
};

const columnHelper = createColumnHelper<TaskInstanceRecord>();

export function TasksPageClient({
  initialTasks,
  canManage,
  mode,
  restaurantId,
}: TasksPageClientProps) {
  const [tasks] = useState(initialTasks);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const modeDescription =
    mode === 'zone_workspace'
      ? 'Vista operativa por zona con capacidad de gestion.'
      : mode === 'restaurant_workspace'
        ? 'Vista operativa del restaurante con capacidad de gestion.'
        : mode === 'global_overview'
          ? 'Vista agregada pendiente de implementar para scopes de organizacion/empresa.'
          : 'Vista personal de tareas asignadas.';

  const columns = useMemo(() => [
    columnHelper.accessor('task_status', {
      header: 'Estado',
      cell: (info) => {
        const val = info.getValue();
        if (val === 'completed') return <span className="flex items-center gap-1 text-green-500"><CheckCircle2 className="w-4 h-4" /> Listo</span>;
        if (val === 'pending') return <span className="flex items-center gap-1 text-amber-500"><Clock className="w-4 h-4" /> Pendiente</span>;
        if (val === 'cancelled') return <span className="flex items-center gap-1 text-red-500"><XCircle className="w-4 h-4" /> Cancelada</span>;
        return <span className="capitalize">{val?.replace('_', ' ')}</span>;
      },
    }),
    columnHelper.accessor('task_date', {
      header: 'Fecha',
      cell: (info) => new Date(info.getValue()).toLocaleDateString('es-AR'),
    }),
    columnHelper.accessor('assigned_role', {
      header: 'Rol Asignado',
      cell: (info) => info.getValue() || '-',
    }),
    columnHelper.accessor('requires_confirmation', {
      header: 'Requiere Confirmación',
      cell: (info) => info.getValue() ? 'Sí' : 'No',
    }),
    columnHelper.display({
      id: 'actions',
      cell: () => (
        <button
          className="text-xs font-medium text-amber-500 hover:text-amber-400 transition"
          type="button"
        >
          Gestionar
        </button>
      ),
    }),
  ], []);

  const data = useMemo(() => tasks, [tasks]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Lista de Tareas</h2>
          <p className="mt-1 text-sm text-muted">{modeDescription}</p>
        </div>
        {canManage && (
          <button 
            className="px-4 py-2 bg-amber-500 text-black font-semibold rounded-full hover:bg-amber-400 transition"
            onClick={() => setIsCreateOpen(true)}
          >
            Crear Tarea
          </button>
        )}
      </div>

      <div className="rounded-xl border border-border/80 bg-surface/80 overflow-hidden shadow-2xl">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-surface-strong/50 text-muted uppercase text-[0.65rem] tracking-wider font-semibold border-b border-border/80">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3">
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
            <tbody className="divide-y divide-border/40">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-muted text-xs">
                    No hay tareas para hoy.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-highlight/30 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-foreground/90">
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

      <TaskCreateDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        restaurantId={restaurantId}
      />
    </div>
  );
}
