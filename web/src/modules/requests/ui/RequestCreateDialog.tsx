'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button, Modal, Select } from '@/shared/ui';

import { createRequestAction } from '../application/requestActions';
import { CreateRequestSchema, type CreateRequestSchemaType } from '../domain/requestSchemas';

type RequestCreateDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  employmentId: string;
};

export function RequestCreateDialog({
  isOpen,
  onClose,
  employmentId,
}: RequestCreateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(CreateRequestSchema),
    defaultValues: {
      employmentId,
      requestType: 'vacation' as const,
      effectiveStartDate: '',
      effectiveEndDate: '',
    },
  });

  const onSubmit = async (rawData: unknown) => {
    const data = rawData as CreateRequestSchemaType;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await createRequestAction(data);
      reset();
      onClose();
    } catch (error: unknown) {
      setErrorMsg(
        error instanceof Error
          ? error.message || 'Error desconocido al crear la solicitud.'
          : 'Error desconocido al crear la solicitud.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Crear solicitud"
      subtitle="Inicia una solicitud laboral u operativa."
      titleId="create-request-modal-title"
      maxWidthClassName="max-w-md"
    >
      <div className="pt-2">
        {errorMsg ? (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/15 p-3 text-sm text-red-500">
            {errorMsg}
          </div>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Tipo de solicitud</label>
            <Select
              {...register('requestType')}
              className="h-10 w-full rounded-xl border-border bg-surface text-sm"
              defaultValue="vacation"
            >
              <option value="vacation">Vacaciones</option>
              <option value="sick_leave">Baja medica</option>
              <option value="justified_absence">Ausencia justificada</option>
              <option value="absence">Aviso de ausencia</option>
            </Select>
            {errors.requestType ? (
              <p className="mt-1 text-xs text-red-500">
                {errors.requestType.message?.toString()}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Fecha de inicio</label>
            <input
              type="date"
              {...register('effectiveStartDate')}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm ring-offset-background placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Fecha de fin</label>
            <input
              type="date"
              {...register('effectiveEndDate')}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm ring-offset-background placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} className="rounded-full">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-amber-500 font-semibold text-black hover:bg-amber-400"
            >
              {isSubmitting ? 'Enviando...' : 'Crear solicitud'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
