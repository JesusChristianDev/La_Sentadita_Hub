'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button, Modal, Select } from '@/shared/ui';

import { createTaskAction } from '../application/taskActions';
import { CreateTaskInstanceSchema, type CreateTaskInstanceSchemaType } from '../domain/taskSchemas';

type TaskCreateDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
};

export function TaskCreateDialog({ isOpen, onClose, restaurantId }: TaskCreateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(CreateTaskInstanceSchema),
    defaultValues: {
      restaurantId,
      taskDate: new Date().toISOString().split('T')[0],
      requiresConfirmation: false,
    },
  });

  const onSubmit = async (rawData: unknown) => {
    const data = rawData as CreateTaskInstanceSchemaType;
    setIsSubmitting(true);
    setErrorMsg(null);
    
    const formData = new FormData();
    formData.append('restaurantId', data.restaurantId);
    formData.append('taskDate', data.taskDate);
    if (data.assignedEmployeeId) formData.append('assignedEmployeeId', data.assignedEmployeeId);
    if (data.assignedRole) formData.append('assignedRole', data.assignedRole);
    if (data.assignedZoneId) formData.append('assignedZoneId', data.assignedZoneId);
    if (data.shiftContext) formData.append('shiftContext', data.shiftContext);
    formData.append('requiresConfirmation', String(data.requiresConfirmation));

    const result = await createTaskAction(formData);
    setIsSubmitting(false);

    if (result.ok) {
      reset();
      onClose();
    } else {
      setErrorMsg(result.error || 'Ocurrió un error inesperado al guardar la tarea.');
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Crear Nueva Tarea"
      subtitle="Asigna una nueva tarea manual o esporádica."
      titleId="create-task-modal-title"
      maxWidthClassName="max-w-lg"
    >
      <div className="pt-2">
        {errorMsg && (
          <div className="mb-4 rounded-lg bg-red-500/15 p-3 text-sm text-red-500 border border-red-500/20">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Fecha de la Tarea</label>
            <input
              type="date"
              {...register('taskDate')}
              className="w-full flex h-10 rounded-xl border border-border bg-surface px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {errors.taskDate && <p className="text-xs text-red-500 mt-1">{errors.taskDate.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Empleado Asignado (Opcional)</label>
            <input
              type="text"
              placeholder="UUID del empleado"
              {...register('assignedEmployeeId')}
              className="w-full flex h-10 rounded-xl border border-border bg-surface px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {errors.assignedEmployeeId && <p className="text-xs text-red-500 mt-1">{errors.assignedEmployeeId.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Rol Asignado (Opcional si hay Empleado)</label>
            <Select
              {...register('assignedRole')}
              className="w-full h-10 rounded-xl border-border bg-surface text-sm"
              defaultValue=""
            >
              <option value="">Cualquier Rol</option>
              <option value="waiter">Camarero</option>
              <option value="cook">Cocinero</option>
              <option value="bartender">Bartender</option>
              <option value="manager">Manager</option>
            </Select>
            {errors.assignedRole && <p className="text-xs text-red-500 mt-1">{errors.assignedRole.message}</p>}
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="rounded-full"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-amber-500 text-black hover:bg-amber-400 font-semibold"
            >
              {isSubmitting ? 'Guardando...' : 'Crear Tarea'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
