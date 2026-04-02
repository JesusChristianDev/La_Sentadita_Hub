'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useMemo, useState, useTransition } from 'react';

import { Button } from '@/shared/ui';

import type { SuppliersPageViewModel } from '../application/buildSuppliersPageViewModel';
import type { CreateDeliveryNoteLineInput } from '../domain/deliveryNoteTypes';
import type { CreateProductInput } from '../domain/productTypes';
import type { CreateSupplierInput, Supplier, SupplierScopeType } from '../domain/supplierTypes';

type Props = SuppliersPageViewModel;

type DeliveryLineDraft = {
  isNewProduct: boolean;
  lineTotal: string;
  productNameRaw: string;
  quantity: string;
  taxRate: string;
  unit: string;
  unitPrice: string;
};

function emptyLine(): DeliveryLineDraft {
  return {
    isNewProduct: false,
    lineTotal: '',
    productNameRaw: '',
    quantity: '1',
    taxRate: '',
    unit: '',
    unitPrice: '',
  };
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  }).then(async (response) => {
    const payload = (await response.json().catch(() => null)) as T | null;
    if (!response.ok) {
      throw new Error((payload as { error?: string } | null)?.error ?? 'REQUEST_FAILED');
    }
    return payload as T;
  });
}

function fmtDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value));
}

function fmtMoney(value: number | null): string {
  if (value === null) return '-';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function parseNullableNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function supplierScopeLabel(value: SupplierScopeType): string {
  return value === 'organization' ? 'Organizacion' : 'Restaurante';
}

function deliveryStatusLabel(value: string): string {
  switch (value) {
    case 'uploaded':
      return 'Subido';
    case 'employee_reviewed':
      return 'Revisado por empleado';
    case 'office_reviewing':
      return 'Revision oficina';
    case 'confirmed':
      return 'Confirmado';
    case 'rejected':
      return 'Rechazado';
    default:
      return value;
  }
}

function statusBadge(value: string): string {
  switch (value) {
    case 'confirmed':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    case 'rejected':
      return 'border-red-500/30 bg-red-500/10 text-red-200';
    case 'office_reviewing':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    default:
      return 'border-border bg-surface text-foreground';
  }
}

export function SuppliersPageClient(props: Props) {
  const {
    activeScopeLabel,
    canCreateDeliveryNote,
    canCreateProduct,
    canCreateSupplier,
    canFinalizeDeliveryNote,
    canReviewDeliveryNote,
    currentRestaurantId,
    currentRestaurantName,
    currentUserId,
    deliveryNotes,
    mode,
    products,
    restaurantChoices,
    scopeChoices,
    suppliers,
  } = props;

  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const [supplierName, setSupplierName] = useState('');
  const [supplierScopeValue, setSupplierScopeValue] = useState(
    scopeChoices[0] ? `${scopeChoices[0].scopeType}:${scopeChoices[0].scopeId}` : '',
  );
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierTaxId, setSupplierTaxId] = useState('');
  const [supplierActive, setSupplierActive] = useState(true);

  const [productSupplierId, setProductSupplierId] = useState(suppliers[0]?.supplier_id ?? '');
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productUnit, setProductUnit] = useState('');

  const [deliveryRestaurantId, setDeliveryRestaurantId] = useState(
    currentRestaurantId ?? restaurantChoices[0]?.id ?? '',
  );
  const [deliverySupplierId, setDeliverySupplierId] = useState(suppliers[0]?.supplier_id ?? '');
  const [deliveryDocumentNumber, setDeliveryDocumentNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTotalAmount, setDeliveryTotalAmount] = useState('');
  const [deliveryTaxAmount, setDeliveryTaxAmount] = useState('');
  const [deliveryLines, setDeliveryLines] = useState<DeliveryLineDraft[]>([emptyLine()]);

  const currentRestaurantLabel = useMemo(
    () => currentRestaurantName ?? currentRestaurantId ?? 'Sin restaurante activo',
    [currentRestaurantId, currentRestaurantName],
  );

  const visibleDeliveryNotes = currentRestaurantId ? deliveryNotes : [];

  const refreshWithMessage = (message: string) => {
    setFeedback(message);
    router.refresh();
  };

  const submitSupplier = () => {
    startTransition(async () => {
      try {
        const [scopeType, scopeId] = supplierScopeValue.split(':') as [SupplierScopeType, string];
        await postJson<{ supplier: Supplier }>('/api/suppliers', {
          contactEmail: supplierEmail || null,
          contactPhone: supplierPhone || null,
          isActive: supplierActive,
          name: supplierName,
          scopeId,
          scopeType,
          taxId: supplierTaxId || null,
        } satisfies CreateSupplierInput);
        setSupplierName('');
        setSupplierEmail('');
        setSupplierPhone('');
        setSupplierTaxId('');
        refreshWithMessage('Proveedor creado.');
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : 'No se pudo crear el proveedor.');
      }
    });
  };

  const submitProduct = () => {
    startTransition(async () => {
      try {
        await postJson<{ product: unknown }>(`/api/suppliers/${productSupplierId}/products`, {
          description: productDescription || null,
          name: productName,
          unit: productUnit || null,
        } satisfies Omit<CreateProductInput, 'supplierId'>);
        setProductName('');
        setProductDescription('');
        setProductUnit('');
        refreshWithMessage('Producto creado.');
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : 'No se pudo crear el producto.');
      }
    });
  };

  const submitDeliveryNote = () => {
    const lines = deliveryLines
      .filter((line) => line.productNameRaw.trim())
      .map((line) => {
        const lineTotal = parseNullableNumber(line.lineTotal);
        const unitPrice = parseNullableNumber(line.unitPrice);
        const quantity = Number(line.quantity);

        return {
          isNewProduct: line.isNewProduct,
          lineTotal: lineTotal ?? (unitPrice !== null ? quantity * unitPrice : null),
          productId: null,
          productNameRaw: line.productNameRaw.trim(),
          quantity,
          taxAmount: null,
          taxRate: parseNullableNumber(line.taxRate),
          unit: line.unit.trim() || null,
          unitPrice,
        } satisfies CreateDeliveryNoteLineInput;
      });

    if (!deliveryRestaurantId || lines.length === 0) {
      setFeedback('Selecciona un restaurante y al menos una linea valida.');
      return;
    }

    startTransition(async () => {
      try {
        await postJson('/api/suppliers/delivery-notes', {
          deliveryDate: deliveryDate || null,
          documentNumber: deliveryDocumentNumber || null,
          lines,
          restaurantId: deliveryRestaurantId,
          supplierId: deliverySupplierId || null,
          taxAmount: deliveryTaxAmount ? Number(deliveryTaxAmount) : null,
          totalAmount: deliveryTotalAmount ? Number(deliveryTotalAmount) : null,
        });

        setDeliveryDate('');
        setDeliveryDocumentNumber('');
        setDeliverySupplierId('');
        setDeliveryTotalAmount('');
        setDeliveryTaxAmount('');
        setDeliveryLines([emptyLine()]);
        refreshWithMessage('Albaran creado.');
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : 'No se pudo crear el albaran.');
      }
    });
  };

  const reviewDeliveryNote = (deliveryNoteId: string) => {
    startTransition(async () => {
      try {
        await postJson(`/api/suppliers/delivery-notes/${deliveryNoteId}/review`, {});
        refreshWithMessage('Albaran revisado.');
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : 'No se pudo revisar el albaran.');
      }
    });
  };

  const confirmDeliveryNote = (deliveryNoteId: string) => {
    startTransition(async () => {
      try {
        await postJson(`/api/suppliers/delivery-notes/${deliveryNoteId}/confirm`, {});
        refreshWithMessage('Albaran confirmado.');
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : 'No se pudo confirmar el albaran.');
      }
    });
  };

  const rejectDeliveryNote = (deliveryNoteId: string) => {
    const rejectionReason = window.prompt('Motivo del rechazo');
    if (!rejectionReason?.trim()) return;

    startTransition(async () => {
      try {
        await postJson(`/api/suppliers/delivery-notes/${deliveryNoteId}/reject`, {
          rejectionReason: rejectionReason.trim(),
        });
        refreshWithMessage('Albaran rechazado.');
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : 'No se pudo rechazar el albaran.');
      }
    });
  };

  const addDeliveryLine = () => {
    setDeliveryLines((current) => [...current, emptyLine()]);
  };

  const updateDeliveryLine = (index: number, patch: Partial<DeliveryLineDraft>) => {
    setDeliveryLines((current) =>
      current.map((line, currentIndex) =>
        currentIndex === index ? { ...line, ...patch } : line,
      ),
    );
  };

  const removeDeliveryLine = (index: number) => {
    setDeliveryLines((current) =>
      current.length === 1 ? current : current.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Contexto" value={activeScopeLabel} />
        <Stat label="Proveedores" value={String(suppliers.length)} />
        <Stat label="Productos" value={String(products.length)} />
        <Stat label="Albaranes" value={String(deliveryNotes.length)} />
      </section>

      {mode === 'global_overview' ? (
        <Notice tone="warning">
          Estas en vista global. Puedes gestionar proveedores y productos; la bandeja de albaranes
          aparece cuando seleccionas un restaurante concreto.
        </Notice>
      ) : null}

      {mode === 'context_required' ? (
        <Notice tone="warning">
          Debes elegir un restaurante para trabajar con albaranes de compra.
        </Notice>
      ) : null}

      {feedback ? <Notice tone="info">{feedback}</Notice> : null}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Proveedores" description="Catalogo de proveedores por scope.">
          <DataTable
            emptyLabel="No hay proveedores visibles."
            headers={['Nombre', 'Scope', 'Activo', 'Contacto']}
            rows={suppliers.map((supplier) => [
              supplier.name,
              supplierScopeLabel(supplier.scope_type),
              supplier.is_active ? 'Si' : 'No',
              supplier.contact_email ?? supplier.contact_phone ?? '-',
            ])}
          />

          {canCreateSupplier ? (
            <form
              className="mt-4 grid gap-3 rounded-3xl border border-border/70 bg-background/50 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                submitSupplier();
              }}
            >
              <h3 className="text-sm font-semibold text-foreground">Crear proveedor</h3>

              <label className="grid gap-1 text-sm">
                <span className="text-muted">Scope</span>
                <select
                  className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                  onChange={(event) => setSupplierScopeValue(event.target.value)}
                  value={supplierScopeValue}
                  required
                >
                  {scopeChoices.map((choice) => (
                    <option
                      key={`${choice.scopeType}:${choice.scopeId}`}
                      value={`${choice.scopeType}:${choice.scopeId}`}
                    >
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-muted">Nombre</span>
                <input
                  className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                  onChange={(event) => setSupplierName(event.target.value)}
                  required
                  value={supplierName}
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-muted">Email</span>
                  <input
                    className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                    onChange={(event) => setSupplierEmail(event.target.value)}
                    value={supplierEmail}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-muted">Telefono</span>
                  <input
                    className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                    onChange={(event) => setSupplierPhone(event.target.value)}
                    value={supplierPhone}
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-muted">NIF / CIF</span>
                  <input
                    className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                    onChange={(event) => setSupplierTaxId(event.target.value)}
                    value={supplierTaxId}
                  />
                </label>
                <label className="flex items-center gap-2 pt-6 text-sm text-muted">
                  <input
                    checked={supplierActive}
                    onChange={(event) => setSupplierActive(event.target.checked)}
                    type="checkbox"
                  />
                  Activo
                </label>
              </div>

              <Button disabled={isPending} type="submit">
                Guardar proveedor
              </Button>
            </form>
          ) : null}
        </Panel>

        <Panel title="Productos" description="Catalogo por proveedor.">
          <DataTable
            emptyLabel="No hay productos visibles."
            headers={['Nombre', 'Proveedor', 'Unidad', 'Activo']}
            rows={products.map((product) => [
              product.name,
              suppliers.find((supplier) => supplier.supplier_id === product.supplier_id)?.name ??
                product.supplier_id.slice(0, 8),
              product.unit ?? '-',
              product.is_active ? 'Si' : 'No',
            ])}
          />

          {canCreateProduct ? (
            <form
              className="mt-4 grid gap-3 rounded-3xl border border-border/70 bg-background/50 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                submitProduct();
              }}
            >
              <h3 className="text-sm font-semibold text-foreground">Crear producto</h3>

              <label className="grid gap-1 text-sm">
                <span className="text-muted">Proveedor</span>
                <select
                  className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                  onChange={(event) => setProductSupplierId(event.target.value)}
                  value={productSupplierId}
                  required
                >
                  <option value="" disabled>
                    Selecciona un proveedor
                  </option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.supplier_id} value={supplier.supplier_id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-muted">Nombre</span>
                <input
                  className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                  onChange={(event) => setProductName(event.target.value)}
                  required
                  value={productName}
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-muted">Descripcion</span>
                <textarea
                  className="min-h-24 rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                  onChange={(event) => setProductDescription(event.target.value)}
                  value={productDescription}
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-muted">Unidad</span>
                <input
                  className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                  onChange={(event) => setProductUnit(event.target.value)}
                  value={productUnit}
                />
              </label>

              <Button disabled={isPending} type="submit">
                Guardar producto
              </Button>
            </form>
          ) : null}
        </Panel>
      </section>

      <Panel
        title="Albaranes"
        description={
          currentRestaurantId
            ? `Albaranes de ${currentRestaurantLabel}.`
            : 'Selecciona un restaurante para trabajar con albaranes.'
        }
      >
        <DataTable
          emptyLabel={
            currentRestaurantId
              ? 'Todavia no hay albaranes para este restaurante.'
              : 'Selecciona un restaurante para ver albaranes.'
          }
          headers={['Numero', 'Proveedor', 'Estado', 'Fecha', 'Total', 'Acciones']}
          rows={visibleDeliveryNotes.map((note) => [
            note.document_number ?? note.delivery_note_id.slice(0, 8),
            suppliers.find((supplier) => supplier.supplier_id === note.supplier_id)?.name ??
              note.supplier_id ??
              '-',
            <span
              key={`${note.delivery_note_id}-status`}
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadge(note.status)}`}
            >
              {deliveryStatusLabel(note.status)}
            </span>,
            note.delivery_date ?? fmtDate(note.created_at),
            fmtMoney(note.total_amount),
            <div key={`${note.delivery_note_id}-actions`} className="flex flex-wrap gap-2">
              <Button
                disabled={!(canReviewDeliveryNote || note.uploaded_by === currentUserId) || isPending}
                type="button"
                variant="secondary"
                onClick={() => reviewDeliveryNote(note.delivery_note_id)}
              >
                Revisar
              </Button>
              <Button
                disabled={!canFinalizeDeliveryNote || isPending}
                type="button"
                onClick={() => confirmDeliveryNote(note.delivery_note_id)}
              >
                Confirmar
              </Button>
              <Button
                disabled={!canFinalizeDeliveryNote || isPending}
                type="button"
                variant="danger"
                onClick={() => rejectDeliveryNote(note.delivery_note_id)}
              >
                Rechazar
              </Button>
            </div>,
          ])}
        />

        {canCreateDeliveryNote ? (
          <form
            className="mt-4 grid gap-3 rounded-3xl border border-border/70 bg-background/50 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitDeliveryNote();
            }}
          >
            <h3 className="text-sm font-semibold text-foreground">Nuevo albaran</h3>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Restaurante</span>
              <select
                className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                onChange={(event) => setDeliveryRestaurantId(event.target.value)}
                value={deliveryRestaurantId}
                required
              >
                <option value="" disabled>
                  Selecciona un restaurante
                </option>
                {restaurantChoices.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Proveedor</span>
              <select
                className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                onChange={(event) => setDeliverySupplierId(event.target.value)}
                value={deliverySupplierId}
              >
                <option value="">Sin proveedor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.supplier_id} value={supplier.supplier_id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-muted">Numero documento</span>
                <input
                  className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                  onChange={(event) => setDeliveryDocumentNumber(event.target.value)}
                  value={deliveryDocumentNumber}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted">Fecha entrega</span>
                <input
                  className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                  onChange={(event) => setDeliveryDate(event.target.value)}
                  type="date"
                  value={deliveryDate}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-muted">Total</span>
                <input
                  className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                  onChange={(event) => setDeliveryTotalAmount(event.target.value)}
                  step="0.01"
                  type="number"
                  value={deliveryTotalAmount}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted">IVA</span>
                <input
                  className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                  onChange={(event) => setDeliveryTaxAmount(event.target.value)}
                  step="0.01"
                  type="number"
                  value={deliveryTaxAmount}
                />
              </label>
            </div>

            <div className="grid gap-3 rounded-2xl border border-border/70 bg-surface/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-foreground">Lineas</h4>
                <Button disabled={isPending} type="button" variant="secondary" onClick={addDeliveryLine}>
                  Anadir linea
                </Button>
              </div>

              {deliveryLines.map((line, index) => (
                <div key={index} className="grid gap-3 rounded-2xl border border-border/70 p-3 md:grid-cols-2">
                  <label className="grid gap-1 text-sm md:col-span-2">
                    <span className="text-muted">Producto / descripcion</span>
                    <input
                      className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                      onChange={(event) =>
                        updateDeliveryLine(index, { productNameRaw: event.target.value })
                      }
                      required
                      value={line.productNameRaw}
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-muted">Cantidad</span>
                    <input
                      className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                      min="1"
                      onChange={(event) => updateDeliveryLine(index, { quantity: event.target.value })}
                      step="1"
                      type="number"
                      value={line.quantity}
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-muted">Unidad</span>
                    <input
                      className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                      onChange={(event) => updateDeliveryLine(index, { unit: event.target.value })}
                      value={line.unit}
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-muted">Precio unitario</span>
                    <input
                      className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                      onChange={(event) =>
                        updateDeliveryLine(index, { unitPrice: event.target.value })
                      }
                      step="0.01"
                      type="number"
                      value={line.unitPrice}
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-muted">IVA linea</span>
                    <input
                      className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                      onChange={(event) => updateDeliveryLine(index, { taxRate: event.target.value })}
                      step="0.01"
                      type="number"
                      value={line.taxRate}
                    />
                  </label>

                  <div className="flex items-center justify-between gap-3 md:col-span-2">
                    <label className="flex items-center gap-2 text-sm text-muted">
                      <input
                        checked={line.isNewProduct}
                        onChange={(event) =>
                          updateDeliveryLine(index, { isNewProduct: event.target.checked })
                        }
                        type="checkbox"
                      />
                      Es producto nuevo
                    </label>
                    <Button
                      disabled={isPending || deliveryLines.length === 1}
                      type="button"
                      variant="secondary"
                      onClick={() => removeDeliveryLine(index)}
                    >
                      Quitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button disabled={isPending} type="submit">
              Guardar albaran
            </Button>
          </form>
        ) : null}
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-border bg-surface/70 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </article>
  );
}

function Notice({ children, tone }: { children: ReactNode; tone: 'info' | 'warning' }) {
  return (
    <div
      className={`rounded-3xl border px-4 py-3 text-sm ${
        tone === 'warning'
          ? 'border-amber-500/20 bg-amber-500/10 text-amber-100'
          : 'border-border bg-surface/70 text-foreground'
      }`}
    >
      {children}
    </div>
  );
}

function Panel({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-surface/70 p-4 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.6)]">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

function DataTable({
  headers,
  rows,
  emptyLabel,
}: {
  headers: string[];
  rows: ReactNode[][];
  emptyLabel: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length} className="py-8 text-center text-sm text-muted">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
