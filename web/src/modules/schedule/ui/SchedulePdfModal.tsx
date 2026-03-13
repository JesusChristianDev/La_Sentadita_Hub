'use client';

import { Download } from 'lucide-react';

import { Button, Modal, Select } from '@/shared/ui';

type SchedulePdfModalProps = {
  employeesCount: number;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onScopeChange: (value: string) => void;
  open: boolean;
  scopeLabel: string;
  scopeOptions: Array<{ label: string; value: string }>;
  selectedScope: string;
};

export function SchedulePdfModal({
  employeesCount,
  isBusy,
  onClose,
  onConfirm,
  onScopeChange,
  open,
  scopeLabel,
  scopeOptions,
  selectedScope,
}: SchedulePdfModalProps) {
  return (
    <Modal
      actions={
        <>
          <Button onClick={onClose} variant="secondary">
            Cancelar
          </Button>
          <Button disabled={isBusy || !employeesCount} onClick={onConfirm}>
            <Download className="h-4 w-4" />
            Confirmar PDF
          </Button>
        </>
      }
      closeLabel="Cerrar seleccion de PDF"
      maxWidthClassName="max-w-md"
      onClose={onClose}
      open={open}
      subtitle="Elige si quieres exportar toda la semana o solo una zona."
      title="Descargar horario en PDF"
      titleId="schedule-pdf-modal-title"
    >
      <label className="field">
        <span>Alcance</span>
        <Select
          aria-labelledby="schedule-pdf-modal-title"
          onChange={(event) => onScopeChange(event.target.value)}
          value={selectedScope}
        >
          {scopeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>

      <p className="modal-subtitle">
        Se exportaran {employeesCount} persona(s) para {scopeLabel.toLowerCase()}.
      </p>
    </Modal>
  );
}
