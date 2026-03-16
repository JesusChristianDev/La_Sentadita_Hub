import {
  ArrowUp,
  ArrowUpRight,
  CheckCircle2,
  LayoutGrid,
  ShieldCheck,
  Store,
} from 'lucide-react';

import { ButtonLink } from './ButtonLink';

type RestaurantContextEmptyStateProps = {
  canPickRestaurant: boolean;
  moduleLabel: string;
};

export function RestaurantContextEmptyState({
  canPickRestaurant,
  moduleLabel,
}: RestaurantContextEmptyStateProps) {
  const normalizedModuleLabel = moduleLabel.toLowerCase();
  const title = canPickRestaurant
    ? `Selecciona una sucursal para desbloquear ${normalizedModuleLabel}.`
    : `${moduleLabel} necesita una sucursal asignada.`;
  const description = canPickRestaurant
    ? `Tu cuenta puede operar en varios restaurantes. Hasta que elijas uno, ${normalizedModuleLabel} se mantiene en espera para evitar datos mezclados o acciones fuera de contexto.`
    : `${moduleLabel} solo puede mostrarse cuando tu cuenta tiene una sucursal disponible como contexto de trabajo.`;
  const hintTitle = canPickRestaurant
    ? 'El selector esta en el encabezado'
    : 'La asignacion depende de tu perfil';
  const hintBody = canPickRestaurant
    ? 'Marca una sucursal arriba y vuelve a entrar al modulo. En cuanto exista ese contexto, la vista cargara su contenido real.'
    : 'Cuando tu cuenta tenga una sucursal valida, este modulo se habilitara automaticamente.';
  const firstStepBody = canPickRestaurant
    ? 'Usa el selector superior para fijar el restaurante con el que vas a trabajar ahora.'
    : 'Revisa la configuracion de tu cuenta o pide que te asignen una sucursal activa.';
  const secondStepBody = canPickRestaurant
    ? `${moduleLabel} se abrira con el contenido correcto en cuanto exista ese contexto.`
    : `${moduleLabel} empezara a mostrar su informacion en cuanto exista una sucursal disponible.`;
  const readinessItems = canPickRestaurant
    ? [
        'Datos cargados del restaurante correcto',
        'Permisos y acciones alineados con la sucursal activa',
        `${moduleLabel} listo para trabajar sin ambiguedad`,
      ]
    : [
        'Una sucursal valida asociada a tu cuenta',
        'Permisos coherentes con ese restaurante',
        `${moduleLabel} disponible con contexto real`,
      ];

  return (
    <section className="restaurant-context-empty" aria-label={`Estado vacio de ${moduleLabel}`}>
      <div className="restaurant-context-empty__layout">
        <div className="restaurant-context-empty__main">
          <header className="restaurant-context-empty__header">
            <div className="restaurant-context-empty__badge-row">
              <span className="restaurant-context-empty__badge">
                Contexto pendiente
              </span>
              <span className="restaurant-context-empty__tag">
                {canPickRestaurant ? 'Rol global' : 'Sin sucursal'}
              </span>
            </div>

            <div className="restaurant-context-empty__hero">
              <span className="restaurant-context-empty__icon" aria-hidden="true">
                <Store className="h-7 w-7" />
              </span>

              <div className="restaurant-context-empty__copy">
                <h2 className="restaurant-context-empty__title">{title}</h2>
                <p className="restaurant-context-empty__description">{description}</p>
              </div>
            </div>

            <div className="restaurant-context-empty__hint">
              <span className="restaurant-context-empty__hint-icon" aria-hidden="true">
                <ArrowUp className="h-5 w-5" />
              </span>
              <div>
                <p className="restaurant-context-empty__hint-title">{hintTitle}</p>
                <p className="restaurant-context-empty__hint-body">{hintBody}</p>
              </div>
            </div>
          </header>

          <div className="restaurant-context-empty__steps">
            <article className="restaurant-context-empty__step">
              <div className="restaurant-context-empty__step-top">
                <span className="restaurant-context-empty__step-index">01</span>
                <span className="restaurant-context-empty__step-icon" aria-hidden="true">
                  <Store className="h-5 w-5" />
                </span>
              </div>
              <div>
                <p className="restaurant-context-empty__step-label">Primero</p>
                <h3 className="restaurant-context-empty__step-title">
                  {canPickRestaurant ? 'Elige una sucursal' : 'Activa tu contexto'}
                </h3>
                <p className="restaurant-context-empty__step-body">{firstStepBody}</p>
              </div>
            </article>

            <article className="restaurant-context-empty__step">
              <div className="restaurant-context-empty__step-top">
                <span className="restaurant-context-empty__step-index">02</span>
                <span className="restaurant-context-empty__step-icon" aria-hidden="true">
                  <LayoutGrid className="h-5 w-5" />
                </span>
              </div>
              <div>
                <p className="restaurant-context-empty__step-label">Despues</p>
                <h3 className="restaurant-context-empty__step-title">Vuelve al modulo</h3>
                <p className="restaurant-context-empty__step-body">{secondStepBody}</p>
              </div>
            </article>
          </div>

          <footer className="restaurant-context-empty__footer">
            <p className="restaurant-context-empty__footnote">
              Mientras no haya sucursal activa, el modulo queda bloqueado para evitar
              acciones sobre el restaurante equivocado.
            </p>

            <div className="restaurant-context-empty__actions">
              <ButtonLink
                href="/app"
                variant="secondary"
                className="restaurant-context-empty__action"
              >
                <ArrowUpRight className="h-4 w-4" />
                Ir al panel
              </ButtonLink>
            </div>
          </footer>
        </div>

        <aside className="restaurant-context-empty__aside">
          <div className="restaurant-context-empty__aside-card restaurant-context-empty__aside-card--status">
            <p className="restaurant-context-empty__aside-eyebrow">Estado actual</p>
            <h3 className="restaurant-context-empty__aside-title">
              {canPickRestaurant ? 'Esperando tu seleccion' : 'Esperando asignacion'}
            </h3>
            <p className="restaurant-context-empty__aside-description">
              {canPickRestaurant
                ? 'Ahora mismo no hay una sucursal activa para este modulo.'
                : 'La cuenta todavia no tiene una sucursal disponible para operar aqui.'}
            </p>

            <div className="restaurant-context-empty__status-pill">
              <span className="restaurant-context-empty__status-dot" aria-hidden="true" />
              Sin sucursal activa
            </div>
          </div>

          <div className="restaurant-context-empty__aside-card">
            <div className="restaurant-context-empty__aside-heading">
              <span className="restaurant-context-empty__aside-icon" aria-hidden="true">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="restaurant-context-empty__aside-eyebrow">
                  Cuando el contexto exista
                </p>
                <h3 className="restaurant-context-empty__aside-title">
                  {moduleLabel} se activara con:
                </h3>
              </div>
            </div>

            <ul className="restaurant-context-empty__checklist">
              {readinessItems.map((item) => (
                <li key={item} className="restaurant-context-empty__checklist-item">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
