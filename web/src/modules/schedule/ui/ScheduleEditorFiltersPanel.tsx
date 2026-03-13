'use client';

import { Search, ShieldAlert } from 'lucide-react';

import type { AppRole } from '@/modules/auth_users';
import type { EmployeeListItem } from '@/modules/employees';
import { roleLabel } from '@/shared/roleLabel';
import { ChipButton, Select } from '@/shared/ui';

import type { RestaurantZone } from '../domain/scheduleTypes';
import type {
  ScheduleCellTypeFilter,
  ScheduleProblemFilter,
  ScheduleZoneFilter,
} from './scheduleUiModels';

type ScheduleEditorFiltersPanelProps = {
  cellTypeFilter: ScheduleCellTypeFilter;
  displayMode: 'day' | 'week';
  employees: EmployeeListItem[];
  maxHoursFilter: string;
  minHoursFilter: string;
  onCellTypeFilterChange: (value: ScheduleCellTypeFilter) => void;
  onMaxHoursFilterChange: (value: string) => void;
  onMinHoursFilterChange: (value: string) => void;
  onProblemFilterChange: (value: ScheduleProblemFilter) => void;
  onRoleFilterChange: (value: 'all' | AppRole) => void;
  onSearchValueChange: (value: string) => void;
  onZoneFilterChange: (value: ScheduleZoneFilter) => void;
  problemFilter: ScheduleProblemFilter;
  roleFilter: 'all' | AppRole;
  searchValue: string;
  totalEmployees: number;
  unassignedCount: number;
  zoneFilter: ScheduleZoneFilter;
  zones: RestaurantZone[];
};

export function ScheduleEditorFiltersPanel({
  cellTypeFilter,
  displayMode,
  employees,
  maxHoursFilter,
  minHoursFilter,
  onCellTypeFilterChange,
  onMaxHoursFilterChange,
  onMinHoursFilterChange,
  onProblemFilterChange,
  onRoleFilterChange,
  onSearchValueChange,
  onZoneFilterChange,
  problemFilter,
  roleFilter,
  searchValue,
  totalEmployees,
  unassignedCount,
  zoneFilter,
  zones,
}: ScheduleEditorFiltersPanelProps) {
  const hoursFilterLabel = displayMode === 'day' ? 'Horas del dia' : 'Horas de la semana';
  const hoursFilterPlaceholder = displayMode === 'day' ? '8' : '40';

  return (
    <div className="schedule-filter-panel rounded-[1.5rem] border border-border/70 bg-background/20 p-4 sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Filtros del equipo</h3>
            <p className="mt-1 text-sm text-muted">
              Trabaja por zona y reduce el barrido antes de entrar al grid.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ChipButton
              active={problemFilter === 'all'}
              onClick={() => onProblemFilterChange('all')}
            >
              Todos
            </ChipButton>
            <ChipButton
              active={problemFilter === 'issues'}
              onClick={() => onProblemFilterChange('issues')}
            >
              <ShieldAlert className="h-4 w-4" />
              Pendientes y errores
            </ChipButton>
          </div>
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-semibold text-foreground">Zonas</p>
          <div className="chip-row overflow-x-auto pb-1">
            <ChipButton active={zoneFilter === 'all'} onClick={() => onZoneFilterChange('all')}>
              Todo ({totalEmployees})
            </ChipButton>
            {zones.map((zone) => {
              const count = employees.filter(
                (employee) => employee.zone_id === zone.id,
              ).length;

              if (!count) return null;

              return (
                <ChipButton
                  key={zone.id}
                  active={zoneFilter === zone.id}
                  onClick={() => onZoneFilterChange(zone.id)}
                >
                  {zone.name} ({count})
                </ChipButton>
              );
            })}
            {unassignedCount ? (
              <ChipButton
                active={zoneFilter === 'unassigned'}
                onClick={() => onZoneFilterChange('unassigned')}
              >
                Sin zona ({unassignedCount})
              </ChipButton>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="field">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <Search className="h-4 w-4 text-accent-strong" />
              Buscar
            </span>
            <input
              className="input"
              onChange={(event) => onSearchValueChange(event.target.value)}
              placeholder="Nombre del empleado"
              value={searchValue}
            />
          </label>
          <label className="field">
            <span className="text-sm font-semibold">Rol</span>
            <Select
              onChange={(event) =>
                onRoleFilterChange(event.target.value as 'all' | AppRole)
              }
              value={roleFilter}
            >
              <option value="all">Todos</option>
              <option value="employee">{roleLabel('employee')}</option>
              <option value="manager">{roleLabel('manager')}</option>
              <option value="sub_manager">{roleLabel('sub_manager')}</option>
              <option value="office">{roleLabel('office')}</option>
              <option value="admin">{roleLabel('admin')}</option>
            </Select>
          </label>
          <label className="field">
            <span className="text-sm font-semibold">Tipo</span>
            <Select
              onChange={(event) =>
                onCellTypeFilterChange(event.target.value as ScheduleCellTypeFilter)
              }
              value={cellTypeFilter}
            >
              <option value="all">Todo</option>
              <option value="work">Trabajo</option>
              <option value="rest">Libre</option>
              <option value="vacation">Vacaciones</option>
              <option value="sick_leave">Baja</option>
              <option value="absent">Ausencia</option>
            </Select>
          </label>
          <label className="field">
            <span className="text-sm font-semibold">
              {displayMode === 'day' ? 'Min horas dia' : 'Min horas semana'}
            </span>
            <input
              className="input"
              inputMode="decimal"
              onChange={(event) => onMinHoursFilterChange(event.target.value)}
              placeholder="0"
              title={`Filtra por ${hoursFilterLabel.toLowerCase()}`}
              value={minHoursFilter}
            />
          </label>
          <label className="field">
            <span className="text-sm font-semibold">
              {displayMode === 'day' ? 'Max horas dia' : 'Max horas semana'}
            </span>
            <input
              className="input"
              inputMode="decimal"
              onChange={(event) => onMaxHoursFilterChange(event.target.value)}
              placeholder={hoursFilterPlaceholder}
              title={`Filtra por ${hoursFilterLabel.toLowerCase()}`}
              value={maxHoursFilter}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
