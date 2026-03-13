'use client';

import { addDays, format } from 'date-fns';
import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { AppRole } from '@/modules/auth_users';
import type { EmployeeListItem } from '@/modules/employees';
import {
  matchesMobileViewport,
  MOBILE_VIEWPORT_MEDIA_QUERY,
} from '@/shared/responsive';

import {
  createScheduleDraftAction,
  createShiftTemplateAction,
  deleteShiftTemplateAction,
  loadEmployeeScheduleWeekAction,
  loadPublishedScheduleDataAction,
  loadPublishReviewAction,
  loadScheduleDataAction,
  loadScheduleHomeAction,
  lockScheduleAction,
  publishScheduleAction,
  saveScheduleCellDraftAction,
  unlockScheduleAction,
  updateShiftTemplateAction,
} from '../application/serverActions';
import type {
  EmployeeScheduleWeekView,
  ScheduleEditorPayload,
  ScheduleLock,
  SchedulePublishReview,
  ShiftTemplateDraftInput,
} from '../domain/scheduleTypes';
import {
  buildEmployeeHours,
  buildProblemEmployeeIds,
  formatDayOptionLabel,
  formatWeekRange,
  getPreferredDisplayMode,
  type NoticeState,
  sanitizeActionError,
  upsertEntry,
} from './scheduleEditorHelpers';
import { ScheduleEditorWorkspace } from './ScheduleEditorWorkspace';
import { ScheduleEmployeeView } from './ScheduleEmployeeView';
import type { ScheduleGridHandle } from './ScheduleGrid';
import { ScheduleHomeView } from './ScheduleHomeView';
import { SchedulePublishReview as SchedulePublishReviewPanel } from './SchedulePublishReview';
import { ScheduleQuickActionsWorkspace } from './ScheduleQuickActionsWorkspace';
import type {
  ScheduleCellTypeFilter,
  ScheduleDisplayMode,
  ScheduleEditorMode,
  ScheduleEditorShellProps,
  ScheduleEditorSurface,
  ScheduleGridHealth,
  ScheduleProblemFilter,
  ScheduleZoneFilter,
} from './scheduleUiModels';

type OpenWeekMode = 'auto' | 'edit' | 'view';
type HistorySyncMode = 'none' | 'push' | 'replace';
type ScheduleHistoryState =
  | { surface: 'editor'; editorMode: ScheduleEditorMode; weekStart: string }
  | { surface: 'home' };

const SCHEDULE_HISTORY_STATE_KEY = '__scheduleEditorState';

function readScheduleHistoryState(value: unknown): ScheduleHistoryState | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = (value as Record<string, unknown>)[SCHEDULE_HISTORY_STATE_KEY];
  if (!candidate || typeof candidate !== 'object') return null;

  const surface = (candidate as Record<string, unknown>).surface;
  if (surface === 'home') {
    return { surface: 'home' };
  }

  if (surface !== 'editor') return null;

  const weekStart = (candidate as Record<string, unknown>).weekStart;
  const editorMode = (candidate as Record<string, unknown>).editorMode;

  if (typeof weekStart !== 'string') return null;
  if (editorMode !== 'edit' && editorMode !== 'view') return null;

  return {
    surface: 'editor',
    editorMode,
    weekStart,
  };
}

function syncScheduleHistoryState(
  mode: Exclude<HistorySyncMode, 'none'>,
  nextState: ScheduleHistoryState,
) {
  if (typeof window === 'undefined') return;

  const currentState =
    window.history.state && typeof window.history.state === 'object'
      ? (window.history.state as Record<string, unknown>)
      : {};

  const mergedState = {
    ...currentState,
    [SCHEDULE_HISTORY_STATE_KEY]: nextState,
  };

  if (mode === 'push') {
    window.history.pushState(mergedState, '', window.location.href);
    return;
  }

  window.history.replaceState(mergedState, '', window.location.href);
}

export default function ScheduleEditor({
  actorName,
  initialEmployeeWeek,
  initialHome,
}: ScheduleEditorShellProps) {
  const [surface, setSurface] = useState<ScheduleEditorSurface>(
    initialHome.permissions.is_employee_view ? 'employee' : 'home',
  );
  const [homeData, setHomeData] = useState(initialHome);
  const [employeeWeek, setEmployeeWeek] = useState<EmployeeScheduleWeekView | null>(
    initialEmployeeWeek ?? null,
  );
  const [editorData, setEditorData] =
    useState<ScheduleEditorPayload<EmployeeListItem> | null>(null);
  const [editorMode, setEditorMode] = useState<ScheduleEditorMode>('edit');
  const [lockStatus, setLockStatus] = useState<ScheduleLock | null>(null);
  const [publishReview, setPublishReview] = useState<SchedulePublishReview | null>(null);
  const [publishComment, setPublishComment] = useState('');
  const [notice, setNotice] = useState<NoticeState>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [displayMode, setDisplayMode] = useState<ScheduleDisplayMode>(
    getPreferredDisplayMode,
  );
  const [isMobileViewport, setIsMobileViewport] = useState(matchesMobileViewport);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [publishPulse, setPublishPulse] = useState(0);
  const [gridHealth, setGridHealth] = useState<ScheduleGridHealth>({
    emptyCount: initialHome.current_week.missing_cells,
    invalidCount: initialHome.current_week.validation_issues,
  });
  const [searchValue, setSearchValue] = useState('');
  const deferredSearch = useDeferredValue(searchValue);
  const [roleFilter, setRoleFilter] = useState<'all' | AppRole>('all');
  const [cellTypeFilter, setCellTypeFilter] =
    useState<ScheduleCellTypeFilter>('all');
  const [minHoursFilter, setMinHoursFilter] = useState('');
  const [maxHoursFilter, setMaxHoursFilter] = useState('');
  const [problemFilter, setProblemFilter] = useState<ScheduleProblemFilter>('all');
  const [zoneFilter, setZoneFilter] = useState<ScheduleZoneFilter>('all');
  const [weekPickerValue, setWeekPickerValue] = useState(
    initialHome.history_weeks[0]?.week_start ?? initialHome.current_week.week_start,
  );
  const gridRef = useRef<ScheduleGridHandle | null>(null);
  const isBrowserHistoryManaged = !initialHome.permissions.is_employee_view;

  const currentSchedule = editorData?.schedule ?? null;
  const permissions = editorData?.permissions ?? homeData.permissions;
  const isMobileManagerExperience =
    isMobileViewport &&
    permissions.can_manage &&
    !permissions.is_employee_view;
  const dayOptions = useMemo(
    () =>
      currentSchedule
        ? Array.from({ length: 7 }, (_, index) => ({
            index,
            label: formatDayOptionLabel(currentSchedule.week_start, index),
          }))
        : [],
    [currentSchedule],
  );

  function resolveOpenMode(
    payload: ScheduleEditorPayload<EmployeeListItem>,
    requestedMode: OpenWeekMode,
  ): ScheduleEditorMode {
    if (requestedMode === 'edit') return 'edit';
    if (requestedMode === 'view') return 'view';

    return payload.schedule.published_at && !payload.publication_state.has_changes
      ? 'view'
      : 'edit';
  }

  useEffect(() => {
    if (!editorData) return;

    setGridHealth({
      emptyCount: editorData.issues.empty_cells,
      invalidCount: editorData.issues.invalid_cells,
    });
  }, [editorData]);

  useEffect(() => {
    setZoneFilter('all');
  }, [currentSchedule?.id]);

  useEffect(() => {
    if (!homeData.history_weeks.length) return;
    if (homeData.history_weeks.some((week) => week.week_start === weekPickerValue)) {
      return;
    }

    setWeekPickerValue(homeData.history_weeks[0].week_start);
  }, [homeData.history_weeks, weekPickerValue]);

  useEffect(() => {
    if (
      !homeData.permissions.is_employee_view ||
      employeeWeek ||
      !homeData.restaurant_id
    ) {
      return;
    }

    const restaurantId = homeData.restaurant_id;

    void (async () => {
      try {
        setIsBusy(true);
        const nextWeek = await loadEmployeeScheduleWeekAction(
          homeData.current_week.week_start,
          restaurantId,
        );
        setEmployeeWeek(nextWeek);
      } catch (error) {
        setNotice({ message: sanitizeActionError(error), tone: 'error' });
      } finally {
        setIsBusy(false);
      }
    })();
  }, [
    employeeWeek,
    homeData.current_week.week_start,
    homeData.permissions.is_employee_view,
    homeData.restaurant_id,
  ]);

  useEffect(() => {
    if (
      surface !== 'editor' ||
      editorMode !== 'edit' ||
      !currentSchedule?.id ||
      !permissions.can_manage ||
      !lockStatus?.acquired
    ) {
      return;
    }

    let cancelled = false;

    const renewLock = async () => {
      try {
        const nextLock = await lockScheduleAction(currentSchedule.id);
        if (!cancelled) setLockStatus(nextLock);
      } catch (error) {
        if (!cancelled) {
          setNotice({ message: sanitizeActionError(error), tone: 'error' });
        }
      }
    };

    void renewLock();
    const intervalId = window.setInterval(() => {
      void renewLock();
    }, 45_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [currentSchedule?.id, editorMode, lockStatus?.acquired, permissions.can_manage, surface]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY);

    const syncDisplayMode = (matches: boolean) => {
      setIsMobileViewport(matches);

      if (matches) {
        setDisplayMode('day');
        setRoleFilter('all');
        setCellTypeFilter('all');
        setMinHoursFilter('');
        setMaxHoursFilter('');
        setProblemFilter('all');
        setZoneFilter('all');
      }
    };

    syncDisplayMode(mediaQuery.matches);

    const onChange = (event: MediaQueryListEvent) => {
      syncDisplayMode(event.matches);
    };

    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (surface === 'publish' && isMobileManagerExperience) {
      setSurface('editor');
    }
  }, [isMobileManagerExperience, surface]);

  const employeeHours = useMemo(
    () =>
      editorData
        ? buildEmployeeHours(
            editorData.schedule.schedule_entries,
            displayMode === 'day' && currentSchedule
              ? [
                  format(
                    addDays(new Date(`${currentSchedule.week_start}T00:00:00`), selectedDayIndex),
                    'yyyy-MM-dd',
                  ),
                ]
              : undefined,
          )
        : new Map(),
    [currentSchedule, displayMode, editorData, selectedDayIndex],
  );

  const problemEmployeeIds = useMemo(
    () => (editorData ? buildProblemEmployeeIds(editorData.issues) : new Set<string>()),
    [editorData],
  );

  const visibleEmployees = useMemo(() => {
    if (!editorData) return [];

    const search = deferredSearch.trim().toLowerCase();
    const minHours = Number(minHoursFilter);
    const maxHours = Number(maxHoursFilter);

    return [...editorData.employees]
      .sort((left, right) => left.full_name.localeCompare(right.full_name, 'es'))
      .filter((employee) => {
        if (search && !employee.full_name.toLowerCase().includes(search)) return false;
        if (roleFilter !== 'all' && employee.role !== roleFilter) return false;
        if (problemFilter === 'issues' && !problemEmployeeIds.has(employee.id)) {
          return false;
        }
        if (zoneFilter === 'unassigned' && employee.zone_id) return false;
        if (
          zoneFilter !== 'all' &&
          zoneFilter !== 'unassigned' &&
          employee.zone_id !== zoneFilter
        ) {
          return false;
        }

        if (cellTypeFilter !== 'all') {
          const hasType = editorData.schedule.schedule_entries.some(
            (entry) =>
              entry.employee_id === employee.id && entry.day_type === cellTypeFilter,
          );
          if (!hasType) return false;
        }

        const totalHours = employeeHours.get(employee.id) ?? 0;
        if (minHoursFilter && Number.isFinite(minHours) && totalHours < minHours) {
          return false;
        }
        if (maxHoursFilter && Number.isFinite(maxHours) && totalHours > maxHours) {
          return false;
        }

        return true;
      });
  }, [
    cellTypeFilter,
    deferredSearch,
    editorData,
    employeeHours,
    maxHoursFilter,
    minHoursFilter,
    problemEmployeeIds,
    problemFilter,
    roleFilter,
    zoneFilter,
  ]);

  async function refreshHome() {
    const nextHome = await loadScheduleHomeAction(homeData.restaurant_id ?? undefined);
    setHomeData(nextHome);
    return nextHome;
  }

  async function acquireEditLock(scheduleId: string): Promise<boolean> {
    try {
      const nextLock = await lockScheduleAction(scheduleId);
      setLockStatus(nextLock);

      if (!nextLock.acquired) {
        setNotice({
          message: nextLock.locked_by_name
            ? `Ahora mismo esta editando ${nextLock.locked_by_name}.`
            : 'No se pudo adquirir el bloqueo de este borrador.',
          tone: 'warning',
        });
        return false;
      }

      return true;
    } catch (error) {
      setNotice({ message: sanitizeActionError(error), tone: 'error' });
      return false;
    }
  }

  async function openWeek(
    weekStart: string,
    requestedMode: OpenWeekMode = 'auto',
    historyMode: HistorySyncMode = 'push',
  ) {
    if (!homeData.restaurant_id) {
      setNotice({
        message: 'Selecciona un restaurante antes de abrir horarios.',
        tone: 'warning',
      });
      return null;
    }

    try {
      setIsBusy(true);
      setBusyLabel(
        requestedMode === 'edit' ? 'Abriendo editor semanal...' : 'Cargando semana...',
      );
      setNotice(null);
      setPublishReview(null);
      setPublishComment('');
      setDisplayMode(getPreferredDisplayMode());
      setSelectedDayIndex(0);
      const payload =
        requestedMode === 'view'
          ? await loadPublishedScheduleDataAction(homeData.restaurant_id, weekStart)
          : await loadScheduleDataAction(homeData.restaurant_id, weekStart);
      let nextEditorMode = resolveOpenMode(payload, requestedMode);
      setEditorData(payload);
      setLockStatus(null);
      setEditorMode(nextEditorMode);
      setSurface('editor');

      if (nextEditorMode === 'edit') {
        const acquired = await acquireEditLock(payload.schedule.id);
        if (!acquired) {
          nextEditorMode = 'view';
          setEditorMode(nextEditorMode);
        }
      }

      if (historyMode !== 'none' && isBrowserHistoryManaged) {
        syncScheduleHistoryState(historyMode, {
          surface: 'editor',
          editorMode: nextEditorMode,
          weekStart,
        });
      }

      return nextEditorMode;
    } catch (error) {
      setNotice({ message: sanitizeActionError(error), tone: 'error' });
      return null;
    } finally {
      setIsBusy(false);
      setBusyLabel(null);
    }
  }

  async function createWeek(weekStart: string) {
    if (!homeData.restaurant_id) {
      setNotice({
        message: 'Selecciona un restaurante antes de crear una semana.',
        tone: 'warning',
      });
      return;
    }

    try {
      setIsBusy(true);
      setBusyLabel('Creando horario semanal...');
      await createScheduleDraftAction(weekStart, homeData.restaurant_id);
      await refreshHome();
      await openWeek(weekStart, 'edit');
    } catch (error) {
      setNotice({ message: sanitizeActionError(error), tone: 'error' });
    } finally {
      setIsBusy(false);
      setBusyLabel(null);
    }
  }

  async function createTemplate(input: ShiftTemplateDraftInput) {
    if (!homeData.restaurant_id) return;

    setIsBusy(true);
    setBusyLabel('Guardando plantilla de turno...');
    try {
      await createShiftTemplateAction(input, homeData.restaurant_id);
      await refreshHome();
      setNotice({ message: 'Plantilla creada correctamente.', tone: 'ok' });
    } catch (error) {
      throw new Error(sanitizeActionError(error));
    } finally {
      setIsBusy(false);
      setBusyLabel(null);
    }
  }

  async function updateTemplate(templateId: string, input: ShiftTemplateDraftInput) {
    if (!homeData.restaurant_id) return;

    setIsBusy(true);
    setBusyLabel('Actualizando plantilla de turno...');
    try {
      await updateShiftTemplateAction(templateId, input, homeData.restaurant_id);
      await refreshHome();
      setNotice({ message: 'Plantilla actualizada.', tone: 'ok' });
    } catch (error) {
      throw new Error(sanitizeActionError(error));
    } finally {
      setIsBusy(false);
      setBusyLabel(null);
    }
  }

  async function deleteTemplate(templateId: string) {
    if (!homeData.restaurant_id) return;

    setIsBusy(true);
    setBusyLabel('Eliminando plantilla de turno...');
    try {
      await deleteShiftTemplateAction(templateId, homeData.restaurant_id);
      await refreshHome();
      setNotice({ message: 'Plantilla eliminada.', tone: 'ok' });
    } catch (error) {
      throw new Error(sanitizeActionError(error));
    } finally {
      setIsBusy(false);
      setBusyLabel(null);
    }
  }

  async function releaseLock() {
    if (!currentSchedule?.id || !lockStatus?.acquired) return;

    try {
      await unlockScheduleAction(currentSchedule.id);
    } catch {
      // Best effort.
    } finally {
      setLockStatus(null);
    }
  }

  async function goHome(historyMode: Extract<HistorySyncMode, 'none' | 'replace'> = 'replace') {
    try {
      await releaseLock();
      await refreshHome();
    } catch (error) {
      setNotice({ message: sanitizeActionError(error), tone: 'error' });
    } finally {
      setEditorData(null);
      setEditorMode('edit');
      setLockStatus(null);
      setPublishReview(null);
      setPublishComment('');
      setSurface('home');

      if (historyMode !== 'none' && isBrowserHistoryManaged) {
        syncScheduleHistoryState(historyMode, { surface: 'home' });
      }
    }
  }

  const applyHistoryState = useEffectEvent(
    async (entry: ScheduleHistoryState, origin: 'initial' | 'popstate') => {
      if (entry.surface === 'home') {
        if (origin === 'popstate') {
          await goHome('none');
        }
        return;
      }

      const restoredMode = await openWeek(entry.weekStart, entry.editorMode, 'none');
      if (!restoredMode) {
        syncScheduleHistoryState('replace', { surface: 'home' });

        if (origin === 'popstate') {
          await goHome('none');
        }
        return;
      }

      if (restoredMode !== entry.editorMode && isBrowserHistoryManaged) {
        syncScheduleHistoryState('replace', {
          surface: 'editor',
          editorMode: restoredMode,
          weekStart: entry.weekStart,
        });
      }
    },
  );

  useEffect(() => {
    if (!isBrowserHistoryManaged) return;

    const currentHistoryState = readScheduleHistoryState(window.history.state);
    if (!currentHistoryState) {
      syncScheduleHistoryState('replace', { surface: 'home' });
      return;
    }

    void applyHistoryState(currentHistoryState, 'initial');
  }, [isBrowserHistoryManaged]);

  useEffect(() => {
    if (!isBrowserHistoryManaged) return;

    const handlePopState = (event: PopStateEvent) => {
      const nextHistoryState = readScheduleHistoryState(event.state);
      if (!nextHistoryState) return;

      void applyHistoryState(nextHistoryState, 'popstate');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isBrowserHistoryManaged]);

  async function saveCell(employeeId: string, date: string, rawValue: string) {
    if (!currentSchedule) return false;

    try {
      const result = await saveScheduleCellDraftAction(
        currentSchedule.id,
        employeeId,
        date,
        rawValue,
      );

      setEditorData((previous) => {
        if (!previous) return previous;

        return {
          ...previous,
          issues: result.issues,
          publication_state: result.publication_state,
          schedule: {
            ...previous.schedule,
            status: result.schedule_status,
            schedule_entries: upsertEntry(
              previous.schedule.schedule_entries,
              result.entry,
            ),
          },
        };
      });

      setGridHealth({
        emptyCount: result.issues.empty_cells,
        invalidCount: result.issues.invalid_cells,
      });

      return true;
    } catch (error) {
      setNotice({ message: sanitizeActionError(error), tone: 'error' });
      return false;
    }
  }

  async function reviewPublish() {
    if (!currentSchedule) return;

    try {
      setIsBusy(true);
      setBusyLabel('Guardando cambios pendientes...');
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const flushSucceeded = await gridRef.current?.flushPendingEdits();
      if (flushSucceeded === false) {
        setPublishPulse((value) => value + 1);
        setNotice({
          message: 'Hay celdas sin guardar o con errores. Revisalas antes de publicar.',
          tone: 'warning',
        });
        return;
      }

      setBusyLabel('Preparando revision de publicacion...');
      const review = await loadPublishReviewAction(currentSchedule.id);
      if (!review.has_changes) {
        setNotice({
          message: 'No hay cambios pendientes respecto a la ultima publicacion.',
          tone: 'warning',
        });
        return;
      }

      if (!review.can_publish) {
        setGridHealth({
          emptyCount: review.missing_cells,
          invalidCount: review.validation_issues,
        });
        setPublishPulse((value) => value + 1);
        setNotice({
          message:
            'No se puede publicar hasta completar todas las celdas y corregir los errores.',
          tone: 'warning',
        });
        return;
      }

      setPublishReview(review);
      setSurface('publish');
    } catch (error) {
      setNotice({ message: sanitizeActionError(error), tone: 'error' });
    } finally {
      setIsBusy(false);
      setBusyLabel(null);
    }
  }

  async function confirmPublish() {
    if (!currentSchedule) return;

    try {
      setIsPublishing(true);
      await publishScheduleAction(currentSchedule.id, publishComment);
      await releaseLock();
      await refreshHome();
      setEditorData(null);
      setEditorMode('edit');
      setPublishReview(null);
      setPublishComment('');
      setSurface('home');
      if (isBrowserHistoryManaged) {
        syncScheduleHistoryState('replace', { surface: 'home' });
      }
      setNotice({ message: 'Horario publicado correctamente.', tone: 'ok' });
    } catch (error) {
      setNotice({ message: sanitizeActionError(error), tone: 'error' });
    } finally {
      setIsPublishing(false);
    }
  }

  async function loadEmployeeWeek(weekStart: string) {
    if (!homeData.restaurant_id) {
      setNotice({
        message: 'No hay restaurante activo para consultar tu horario.',
        tone: 'warning',
      });
      return;
    }

    const restaurantId = homeData.restaurant_id;

    try {
      setIsBusy(true);
      const nextWeek = await loadEmployeeScheduleWeekAction(weekStart, restaurantId);
      setEmployeeWeek(nextWeek);
      setSurface('employee');
      setWeekPickerValue(weekStart);
    } catch (error) {
      setNotice({ message: sanitizeActionError(error), tone: 'error' });
    } finally {
      setIsBusy(false);
    }
  }

  if (surface === 'publish' && publishReview) {
    return (
      <SchedulePublishReviewPanel
        affectedEmployees={publishReview.affected_employee_ids.length}
        comment={publishComment}
        isPublishing={isPublishing}
        isRepublish={publishReview.publication_kind === 'republish'}
        onBack={() => setSurface('editor')}
        onCommentChange={setPublishComment}
        onConfirm={() => void confirmPublish()}
        rangeLabel={publishReview.range_label ?? formatWeekRange(publishReview.week_start)}
        weekLabel={`Semana del ${publishReview.week_start}`}
      />
    );
  }

  if (surface === 'employee') {
    return (
      <ScheduleEmployeeView
        actorName={actorName}
        currentWeekStart={homeData.current_week.week_start}
        employeeWeek={employeeWeek}
        isBusy={isBusy}
        notice={notice}
        onLoadEmployeeWeek={(weekStart) => {
          void loadEmployeeWeek(weekStart);
        }}
        onWeekPickerChange={setWeekPickerValue}
        weekPickerValue={weekPickerValue}
      />
    );
  }

  if (surface === 'editor' && editorData && currentSchedule) {
    if (isMobileManagerExperience) {
      return (
        <ScheduleQuickActionsWorkspace
          dayOptions={dayOptions}
          editorData={editorData}
          editorMode={editorMode}
          gridHealth={gridHealth}
          gridRef={gridRef}
          isBusy={isBusy}
          lockStatus={lockStatus}
          notice={notice}
          onBack={() => {
            void goHome();
          }}
          onGridHealthChange={setGridHealth}
          onSaveCell={saveCell}
          onSearchValueChange={setSearchValue}
          onSelectedDayIndexChange={setSelectedDayIndex}
          onZoneFilterChange={setZoneFilter}
          publicationState={editorData.publication_state}
          publishPulse={publishPulse}
          searchValue={searchValue}
          selectedDayIndex={selectedDayIndex}
          totalEmployees={editorData.employees.length}
          visibleEmployees={visibleEmployees}
          zoneFilter={zoneFilter}
        />
      );
    }

    return (
      <ScheduleEditorWorkspace
        cellTypeFilter={cellTypeFilter}
        dayOptions={dayOptions}
        displayMode={displayMode}
        editorMode={editorMode}
        editorData={editorData}
        gridHealth={gridHealth}
        gridRef={gridRef}
        isBusy={isBusy}
        lockStatus={lockStatus}
        maxHoursFilter={maxHoursFilter}
        minHoursFilter={minHoursFilter}
        notice={notice}
        onBack={() => {
          void goHome();
        }}
        onCellTypeFilterChange={setCellTypeFilter}
        onDisplayModeChange={setDisplayMode}
        onGridHealthChange={setGridHealth}
        onMaxHoursFilterChange={setMaxHoursFilter}
        onMinHoursFilterChange={setMinHoursFilter}
        onProblemFilterChange={setProblemFilter}
        onReviewPublish={() => {
          void reviewPublish();
        }}
        onRoleFilterChange={setRoleFilter}
        onSaveCell={saveCell}
        onSearchValueChange={setSearchValue}
        onSelectedDayIndexChange={setSelectedDayIndex}
        problemFilter={problemFilter}
        publicationState={editorData.publication_state}
        publishPulse={publishPulse}
        roleFilter={roleFilter}
        searchValue={searchValue}
        selectedDayIndex={selectedDayIndex}
        totalEmployees={editorData.employees.length}
        visibleEmployees={visibleEmployees}
        zoneFilter={zoneFilter}
        onZoneFilterChange={setZoneFilter}
      />
    );
  }

  return (
    <ScheduleHomeView
      busyLabel={busyLabel}
      homeData={homeData}
      isMobileManagerExperience={isMobileManagerExperience}
      isBusy={isBusy}
      notice={notice}
      onCreateTemplate={(input) => createTemplate(input)}
      onCreateWeek={(weekStart) => {
        void createWeek(weekStart);
      }}
      onDeleteTemplate={(templateId) => deleteTemplate(templateId)}
      onEditTemplate={(templateId, input) => updateTemplate(templateId, input)}
      onEditWeek={(weekStart) => {
        void openWeek(weekStart, 'edit');
      }}
      onHistoryWeek={(weekStart) => {
        void openWeek(weekStart, 'auto');
      }}
      onViewWeek={(weekStart) => {
        void openWeek(weekStart, 'view');
      }}
      onWeekPickerChange={setWeekPickerValue}
      weekPickerValue={weekPickerValue}
    />
  );
}
