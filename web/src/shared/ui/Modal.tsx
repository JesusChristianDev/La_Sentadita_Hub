'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from './Button';
import { cx } from './cx';

type ModalProps = {
  actions?: ReactNode;
  children?: ReactNode;
  closeLabel?: string;
  maxWidthClassName?: string;
  onClose: () => void;
  open: boolean;
  subtitle?: ReactNode;
  title: ReactNode;
  titleId: string;
};

export function Modal({
  actions,
  children,
  closeLabel = 'Cerrar modal',
  maxWidthClassName,
  onClose,
  open,
  subtitle,
  title,
  titleId,
}: ModalProps) {
  if (!open) return null;

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
    >
      <div
        className={cx('modal-content w-full', maxWidthClassName)}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 className="modal-title" id={titleId}>
              {title}
            </h3>
            {subtitle ? <p className="modal-subtitle">{subtitle}</p> : null}
          </div>
          <Button
            aria-label={closeLabel}
            className="modal-close-button"
            onClick={onClose}
            variant="secondary"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {children ? <div className="modal-body">{children}</div> : null}

        {actions ? <div className="modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
