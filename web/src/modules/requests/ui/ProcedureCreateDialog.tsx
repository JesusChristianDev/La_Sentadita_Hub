'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button, Modal, Select } from '@/shared/ui';

import { createProcedureAction } from '../application/procedureActions';
import { CreateProcedureSchema, type CreateProcedureSchemaType } from '../domain/procedureSchemas';

type ProcedureCreateDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Pass the current user's active employment ID here */
  employmentId: string;
};

export function ProcedureCreateDialog({ isOpen, onClose, employmentId }: ProcedureCreateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(CreateProcedureSchema),
    defaultValues: {
      employmentId,
      procedureType: 'vacation' as const,
      effectiveStartDate: '',
      effectiveEndDate: '',
    },
  });

  const onSubmit = async (rawData: unknown) => {
    const data = rawData as CreateProcedureSchemaType;
    setIsSubmitting(true);
    setErrorMsg(null);
    
    try {
      await createProcedureAction(data);
      reset();
      onClose();
    } catch (e: unknown) {
      if (e instanceof Error) {
        setErrorMsg(e.message || 'Error desconocido al crear el trámite.');
      } else {
        setErrorMsg('Error desconocido al crear el trámite.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Solicitar Nuevo Trámite"
      subtitle="Inicia un pedido de vacaciones, licencia, u otra solicitud formal."
      titleId="create-procedure-modal-title"
      maxWidthClassName="max-w-md"
    >
      <div className="pt-2">
        {errorMsg && (
          <div className="mb-4 rounded-lg bg-red-500/15 p-3 text-sm text-red-500 border border-red-500/20">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Tipo de Trámite</label>
            <Select
              {...register('procedureType')}
              className="w-full h-10 rounded-xl border-border bg-surface text-sm"
              defaultValue="vacation"
            >
              <option value="vacation">Vacaciones</option>
              <option value="sick_leave">Licencia Médica</option>
              <option value="justified_absence">Ausencia Justificada</option>
              <option value="absence">Aviso de Ausencia</option>
            </Select>
            {errors.procedureType && <p className="text-xs text-red-500 mt-1">{errors.procedureType.message?.toString()}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Fecha de Inicio (Opcional)</label>
            <input
              type="date"
              {...register('effectiveStartDate')}
              className="w-full flex h-10 rounded-xl border border-border bg-surface px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Fecha de Fin (Opcional)</label>
            <input
              type="date"
              {...register('effectiveEndDate')}
              className="w-full flex h-10 rounded-xl border border-border bg-surface px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
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
              {isSubmitting ? 'Enviando...' : 'Solicitar Trámite'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
