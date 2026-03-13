'use server';

import type { AppRole, UserContext } from '@/modules/auth_users';
import {
  getCurrentUserContext,
  getEffectiveRestaurantId,
} from '@/modules/auth_users';
import type { EmployeeListItem } from '@/modules/employees';
import { listEmployees } from '@/modules/employees';
import { getRestaurantStatus } from '@/modules/restaurants';
import {
  canAccessScheduleEditor,
  canAccessSchedulesModule,
  canEditEmployeeSchedule,
  canManageShiftTemplates,
  canPublishSchedules,
  getScheduleActorRank,
} from '@/shared/schedulePolicy';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

import type {
  EmployeeScheduleWeekView,
  Schedule,
  ScheduleEditorPayload,
  ScheduleEntry,
  ScheduleHomePayload,
  ScheduleIssueSummary,
  SchedulePublicationState,
  SchedulePublishReview,
  ScheduleSaveCellResult,
  ScheduleWithEntries,
  ShiftTemplate,
  ShiftTemplateDraftInput,
} from '../domain/scheduleTypes';
import {
  acquireLock,
  createScheduleEntry,
  createShiftTemplateRecord,
  deactivateShiftTemplateRecord,
  forceReleaseLock,
  getActiveScheduleLock,
  getEntryByNaturalKey,
  getEntryWithSchedule,
  getScheduleById,
  getScheduleByWeek,
  getScheduleConfig,
  getScheduleLockOwnerActor,
  getScheduleWithEntriesById,
  insertScheduleEntryLog,
  listRestaurantZones,
  listScheduleEntries,
  listScheduleEntryLogs,
  listScheduleHistoryWeeks,
  listSchedulesByWeeks,
  listShiftTemplates,
  markScheduleAsDraft,
  updateShiftTemplateRecord,
} from '../infrastructure/scheduleRepository';
import { ensureScheduleDraft } from './getSchedule';
import { unlockSchedule } from './lockActions';
import { publishScheduleWeek } from './publishSchedule';
import { createScheduleDraftService } from './scheduleDraftService';
import { createScheduleLockService } from './scheduleLockService';
import { createSchedulePublicationService } from './schedulePublicationService';
import {
  buildEmployeeWeekView,
  buildPublicationState,
  buildPublishedSnapshotEntries,
  buildPublishReview,
  buildSchedulePermissions,
  buildWeekSummary,
  getCurrentAndNextWeekStarts,
  getWeekRangeLabel,
  summarizeScheduleIssues,
} from './scheduleWorkspace';
import { validateShiftText } from './shiftValidation';
import { updateEntry } from './updateScheduleEntry';

type EmployeeScopeRow = {
  full_name: string;
  restaurant_id: string | null;
  role: AppRole;
  zone_id: string | null;
};

function isRestaurantScopedActor(ctx: UserContext): boolean {
  return (
    ctx.profile.role === 'manager' ||
    ctx.profile.role === 'sub_manager' ||
    ctx.profile.role === 'employee' ||
    ctx.profile.is_area_lead
  );
}

function assertCanAccessModule(ctx: UserContext): void {
  if (!canAccessSchedulesModule(ctx.profile)) {
    throw new Error('FORBIDDEN: No tienes permisos para acceder a horarios.');
  }
}

function assertCanManageDraft(ctx: UserContext): void {
  if (!canAccessScheduleEditor(ctx.profile)) {
    throw new Error('FORBIDDEN: No tienes permisos para editar borradores.');
  }
}

function assertCanManageTemplates(ctx: UserContext): void {
  if (!canManageShiftTemplates(ctx.profile)) {
    throw new Error('FORBIDDEN: No tienes permisos para gestionar plantillas de turno.');
  }
}

function assertCanPublish(ctx: UserContext): void {
  if (!canPublishSchedules(ctx.profile)) {
    throw new Error('FORBIDDEN: No tienes permisos para publicar horarios.');
  }
}

async function resolveTargetRestaurantId(
  ctx: UserContext,
  restaurantId?: string,
): Promise<string | null> {
  if (restaurantId) return restaurantId;
  return getEffectiveRestaurantId(ctx.profile);
}

async function assertRestaurantAccess(
  ctx: UserContext,
  restaurantId: string,
): Promise<void> {
  assertCanAccessModule(ctx);

  if (
    isRestaurantScopedActor(ctx) &&
    ctx.profile.restaurant_id &&
    ctx.profile.restaurant_id !== restaurantId
  ) {
    throw new Error('FORBIDDEN: No puedes acceder a horarios de otro restaurante.');
  }

  const status = await getRestaurantStatus(restaurantId);
  if (!status || !status.is_active) {
    throw new Error('RESTAURANT_UNAVAILABLE: El restaurante no existe o esta inactivo.');
  }
}

async function loadAuthorizedSchedule(ctx: UserContext, scheduleId: string): Promise<Schedule> {
  const schedule = await getScheduleById(scheduleId);
  if (!schedule) {
    throw new Error('SCHEDULE_NOT_FOUND: El horario no existe.');
  }

  await assertRestaurantAccess(ctx, schedule.restaurant_id);
  return schedule;
}

async function loadAuthorizedScheduleWithEntries(
  ctx: UserContext,
  scheduleId: string,
): Promise<ScheduleWithEntries> {
  const schedule = await getScheduleWithEntriesById(scheduleId);
  if (!schedule) {
    throw new Error('SCHEDULE_NOT_FOUND: El horario no existe.');
  }

  await assertRestaurantAccess(ctx, schedule.restaurant_id);
  return schedule;
}

async function loadAuthorizedEntry(ctx: UserContext, entryId: string) {
  const entry = await getEntryWithSchedule(entryId);
  if (!entry?.schedule) {
    throw new Error('SCHEDULE_ENTRY_NOT_FOUND: La celda no existe.');
  }

  await assertRestaurantAccess(ctx, entry.schedule.restaurant_id);
  return entry;
}

async function loadEmployeeScope(
  employeeId: string,
  restaurantId: string,
): Promise<EmployeeScopeRow> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('full_name, restaurant_id, role, zone_id')
    .eq('id', employeeId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load employee scope: ${error.message}`);
  }

  if (!data) {
    throw new Error('EMPLOYEE_NOT_FOUND: El empleado no existe.');
  }

  const typed = data as EmployeeScopeRow;
  if (typed.restaurant_id !== restaurantId) {
    throw new Error('FORBIDDEN: El empleado no pertenece al restaurante del horario.');
  }

  return typed;
}

async function assertCanEditEmployeeDraft(
  ctx: UserContext,
  employeeId: string,
  restaurantId: string,
): Promise<EmployeeScopeRow> {
  const employee = await loadEmployeeScope(employeeId, restaurantId);
  if (
    !canEditEmployeeSchedule(ctx.profile, {
      id: employeeId,
      zone_id: employee.zone_id,
    })
  ) {
    throw new Error('FORBIDDEN: No puedes editar horarios fuera de tu alcance.');
  }

  return employee;
}

async function assertScheduleLockOwnedByUser(
  scheduleId: string,
  userId: string,
): Promise<void> {
  await getScheduleLockService().ensureLockOwnedByUser({
    scheduleId,
    userId,
  });
}

function filterEmployeesForDraftScope(
  ctx: UserContext,
  employees: EmployeeListItem[],
): EmployeeListItem[] {
  if (!ctx.profile.is_area_lead || !ctx.profile.zone_id) return employees;
  return employees.filter((employee) => employee.zone_id === ctx.profile.zone_id);
}

function buildShiftTemplateText(input: ShiftTemplateDraftInput): string {
  const firstRange = `${input.start_time}-${input.end_time}`;
  if (input.type !== 'split') return firstRange;

  if (!input.split_start_time || !input.split_end_time) {
    throw new Error(
      'INVALID_SHIFT_TEMPLATE: La plantilla de turno partido necesita dos tramos completos.',
    );
  }

  return `${firstRange} ${input.split_start_time}-${input.split_end_time}`;
}

async function validateShiftTemplateInput(
  restaurantId: string,
  input: ShiftTemplateDraftInput,
): Promise<ShiftTemplateDraftInput> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('INVALID_SHIFT_TEMPLATE: La plantilla necesita un nombre.');
  }

  const config = await getScheduleConfig(restaurantId);
  const validation = validateShiftText(buildShiftTemplateText(input), config);
  if (!validation.ok) {
    throw new Error(`INVALID_SHIFT_TEMPLATE: ${validation.error}`);
  }

  return {
    end_time: validation.shift.end_time,
    name,
    split_end_time:
      input.type === 'split' ? validation.shift.split_end_time ?? null : null,
    split_start_time:
      input.type === 'split' ? validation.shift.split_start_time ?? null : null,
    start_time: validation.shift.start_time,
    type: input.type,
  };
}

async function buildIssueSummaryForSchedule(
  restaurantId: string,
  weekStart: string,
  entries: ScheduleEntry[],
  employees: EmployeeListItem[],
): Promise<ScheduleIssueSummary> {
  const config = await getScheduleConfig(restaurantId);
  return summarizeScheduleIssues({
    config,
    employees,
    entries,
    weekStart,
  });
}

async function getPublishedEntriesForSchedule(
  schedule: ScheduleWithEntries,
): Promise<ScheduleEntry[]> {
  if (!schedule.published_at || schedule.schedule_entries.length === 0) return [];

  try {
    const logs = await listScheduleEntryLogs(
      schedule.schedule_entries.map((entry) => entry.id),
      {
        upToChangedAt: schedule.published_at,
      },
    );

    return buildPublishedSnapshotEntries({
      entries: schedule.schedule_entries,
      logs,
      publishedAt: schedule.published_at,
    });
  } catch {
    // Fallback for environments where immutable logs are not fully available yet.
    return schedule.schedule_entries;
  }
}

async function buildPublicationStateForSchedule(params: {
  employees: EmployeeListItem[];
  issues: ScheduleIssueSummary;
  schedule: ScheduleWithEntries;
}): Promise<SchedulePublicationState> {
  const publishedEntries = await getPublishedEntriesForSchedule(params.schedule);
  const review = buildPublishReview({
    currentEntries: params.schedule.schedule_entries,
    employees: params.employees,
    issues: params.issues,
    publishedEntries,
    schedule: params.schedule,
  });

  return buildPublicationState(review);
}

function resolveHomeStatus(
  schedule: Schedule | null,
  publicationState: SchedulePublicationState | null,
): Schedule['status'] | 'missing' {
  if (!schedule) return 'missing';
  if (schedule.status === 'published') return 'published';
  if (schedule.published_at && publicationState && !publicationState.has_changes) {
    return 'published';
  }

  return 'draft';
}

function getScheduleDraftService() {
  return createScheduleDraftService({
    buildIssueSummaryForSchedule,
    buildPublicationStateForSchedule,
    createScheduleEntry,
    getEntryByNaturalKey,
    getScheduleConfig,
    insertScheduleEntryLog,
    listEmployees,
    listScheduleEntries,
    markScheduleAsDraft,
    updateEntry,
  });
}

function getScheduleLockService() {
  return createScheduleLockService({
    acquireLock,
    forceReleaseLock,
    getActiveScheduleLock,
    getActorRank: getScheduleActorRank,
    getLockOwnerActor: getScheduleLockOwnerActor,
  });
}

export async function loadScheduleHomeAction(
  restaurantId?: string,
): Promise<ScheduleHomePayload> {
  const ctx = await getCurrentUserContext();
  if (!ctx) throw new Error('Unauthorized');

  const targetRestaurantId = await resolveTargetRestaurantId(ctx, restaurantId);
  const permissions = buildSchedulePermissions(ctx.profile);
  const { currentWeekStart, nextWeekStart } = getCurrentAndNextWeekStarts();

  if (!targetRestaurantId) {
    return {
      current_week: buildWeekSummary({
        config: {
          min_shift_duration_minutes: 60,
          min_split_break_minutes: 60,
          timezone: 'Europe/Madrid',
        },
        employees: [],
        schedule: null,
        scheduleEntries: [],
        weekStart: currentWeekStart,
      }),
      history_weeks: [],
      next_week: buildWeekSummary({
        config: {
          min_shift_duration_minutes: 60,
          min_split_break_minutes: 60,
          timezone: 'Europe/Madrid',
        },
        employees: [],
        schedule: null,
        scheduleEntries: [],
        weekStart: nextWeekStart,
      }),
      permissions,
      restaurant_id: null,
      shift_templates: [],
    };
  }

  await assertRestaurantAccess(ctx, targetRestaurantId);

  const [employees, schedules, historySchedules, config, shiftTemplates] = await Promise.all([
    listEmployees(targetRestaurantId, 'active'),
    listSchedulesByWeeks(targetRestaurantId, [currentWeekStart, nextWeekStart]),
    listScheduleHistoryWeeks(targetRestaurantId),
    getScheduleConfig(targetRestaurantId),
    listShiftTemplates(targetRestaurantId),
  ]);

  const scopedEmployees = filterEmployeesForDraftScope(ctx, employees);
  const scheduleByWeek = new Map(schedules.map((schedule) => [schedule.week_start, schedule]));

  const [currentEntries, nextEntries] = await Promise.all([
    scheduleByWeek.get(currentWeekStart)
      ? listScheduleEntries(scheduleByWeek.get(currentWeekStart)!.id)
      : Promise.resolve([]),
    scheduleByWeek.get(nextWeekStart)
      ? listScheduleEntries(scheduleByWeek.get(nextWeekStart)!.id)
      : Promise.resolve([]),
  ]);

  const currentScheduleWithEntries = scheduleByWeek.get(currentWeekStart)
    ? {
        ...scheduleByWeek.get(currentWeekStart)!,
        schedule_entries: currentEntries,
      }
    : null;
  const nextScheduleWithEntries = scheduleByWeek.get(nextWeekStart)
    ? {
        ...scheduleByWeek.get(nextWeekStart)!,
        schedule_entries: nextEntries,
      }
    : null;

  const [currentIssues, nextIssues] = await Promise.all([
    buildIssueSummaryForSchedule(
      targetRestaurantId,
      currentWeekStart,
      currentEntries,
      scopedEmployees,
    ),
    buildIssueSummaryForSchedule(
      targetRestaurantId,
      nextWeekStart,
      nextEntries,
      scopedEmployees,
    ),
  ]);

  const [currentPublicationState, nextPublicationState] = await Promise.all([
    currentScheduleWithEntries
      ? buildPublicationStateForSchedule({
          employees: scopedEmployees,
          issues: currentIssues,
          schedule: currentScheduleWithEntries,
        })
      : Promise.resolve(null),
    nextScheduleWithEntries
      ? buildPublicationStateForSchedule({
          employees: scopedEmployees,
          issues: nextIssues,
          schedule: nextScheduleWithEntries,
        })
      : Promise.resolve(null),
  ]);

  return {
    current_week: buildWeekSummary({
      config,
      displayStatus: resolveHomeStatus(
        currentScheduleWithEntries,
        currentPublicationState,
      ),
      employees: scopedEmployees,
      schedule: currentScheduleWithEntries,
      scheduleEntries: currentEntries,
      weekStart: currentWeekStart,
    }),
    history_weeks: historySchedules
      .filter(
        (schedule) =>
          schedule.week_start !== currentWeekStart &&
          schedule.week_start !== nextWeekStart,
      )
      .map((schedule) => ({
        range_label: getWeekRangeLabel(schedule.week_start),
        week_start: schedule.week_start,
      })),
    next_week: buildWeekSummary({
      config,
      displayStatus: resolveHomeStatus(nextScheduleWithEntries, nextPublicationState),
      employees: scopedEmployees,
      schedule: nextScheduleWithEntries,
      scheduleEntries: nextEntries,
      weekStart: nextWeekStart,
    }),
    permissions,
    restaurant_id: targetRestaurantId,
    shift_templates: shiftTemplates,
  };
}

export async function createScheduleDraftAction(
  weekStart: string,
  restaurantId?: string,
): Promise<ScheduleWithEntries> {
  const ctx = await getCurrentUserContext();
  if (!ctx || !ctx.profile.id) throw new Error('Unauthorized');

  assertCanManageDraft(ctx);

  const targetRestaurantId = await resolveTargetRestaurantId(ctx, restaurantId);
  if (!targetRestaurantId) {
    throw new Error('NO_RESTAURANT_CONTEXT: Selecciona un restaurante antes de crear horarios.');
  }

  await assertRestaurantAccess(ctx, targetRestaurantId);
  return ensureScheduleDraft(targetRestaurantId, weekStart, ctx.userId);
}

export async function createShiftTemplateAction(
  input: ShiftTemplateDraftInput,
  restaurantId?: string,
): Promise<ShiftTemplate> {
  const ctx = await getCurrentUserContext();
  if (!ctx) throw new Error('Unauthorized');

  assertCanManageTemplates(ctx);

  const targetRestaurantId = await resolveTargetRestaurantId(ctx, restaurantId);
  if (!targetRestaurantId) {
    throw new Error(
      'NO_RESTAURANT_CONTEXT: Selecciona un restaurante antes de crear plantillas.',
    );
  }

  await assertRestaurantAccess(ctx, targetRestaurantId);
  const payload = await validateShiftTemplateInput(targetRestaurantId, input);
  return createShiftTemplateRecord(targetRestaurantId, payload);
}

export async function updateShiftTemplateAction(
  templateId: string,
  input: ShiftTemplateDraftInput,
  restaurantId?: string,
): Promise<ShiftTemplate> {
  const ctx = await getCurrentUserContext();
  if (!ctx) throw new Error('Unauthorized');

  assertCanManageTemplates(ctx);

  const targetRestaurantId = await resolveTargetRestaurantId(ctx, restaurantId);
  if (!targetRestaurantId) {
    throw new Error(
      'NO_RESTAURANT_CONTEXT: Selecciona un restaurante antes de editar plantillas.',
    );
  }

  await assertRestaurantAccess(ctx, targetRestaurantId);
  const payload = await validateShiftTemplateInput(targetRestaurantId, input);
  return updateShiftTemplateRecord(templateId, targetRestaurantId, payload);
}

export async function deleteShiftTemplateAction(
  templateId: string,
  restaurantId?: string,
): Promise<void> {
  const ctx = await getCurrentUserContext();
  if (!ctx) throw new Error('Unauthorized');

  assertCanManageTemplates(ctx);

  const targetRestaurantId = await resolveTargetRestaurantId(ctx, restaurantId);
  if (!targetRestaurantId) {
    throw new Error(
      'NO_RESTAURANT_CONTEXT: Selecciona un restaurante antes de eliminar plantillas.',
    );
  }

  await assertRestaurantAccess(ctx, targetRestaurantId);
  await deactivateShiftTemplateRecord(templateId, targetRestaurantId);
}

export async function loadScheduleDataAction(
  restaurantId: string,
  weekStart: string,
): Promise<ScheduleEditorPayload<EmployeeListItem>> {
  const ctx = await getCurrentUserContext();
  if (!ctx || !ctx.profile.id) throw new Error('Unauthorized');

  assertCanManageDraft(ctx);

  const targetRestaurantId = await resolveTargetRestaurantId(ctx, restaurantId);
  if (!targetRestaurantId) {
    throw new Error('NO_RESTAURANT_CONTEXT: Selecciona un restaurante antes de abrir horarios.');
  }

  await assertRestaurantAccess(ctx, targetRestaurantId);

  const [schedule, employees, zones, templates, config] = await Promise.all([
    getScheduleByWeek(targetRestaurantId, weekStart),
    listEmployees(targetRestaurantId, 'active'),
    listRestaurantZones(targetRestaurantId),
    listShiftTemplates(targetRestaurantId),
    getScheduleConfig(targetRestaurantId),
  ]);

  if (!schedule) {
    throw new Error('SCHEDULE_NOT_FOUND: Crea la semana antes de editarla.');
  }

  const scopedEmployees = filterEmployeesForDraftScope(ctx, employees);
  const scopedZones =
    ctx.profile.is_area_lead && ctx.profile.zone_id
      ? zones.filter((zone) => zone.id === ctx.profile.zone_id)
      : zones;
  const issues = summarizeScheduleIssues({
    config,
    employees: scopedEmployees,
    entries: schedule.schedule_entries,
    weekStart,
  });
  const publication_state = await buildPublicationStateForSchedule({
    employees: scopedEmployees,
    issues,
    schedule,
  });

  return {
    config,
    employees: scopedEmployees,
    issues,
    permissions: buildSchedulePermissions(ctx.profile),
    publication_state,
    schedule,
    shift_templates: templates,
    zones: scopedZones,
  };
}

export async function loadPublishedScheduleDataAction(
  restaurantId: string,
  weekStart: string,
): Promise<ScheduleEditorPayload<EmployeeListItem>> {
  const ctx = await getCurrentUserContext();
  if (!ctx || !ctx.profile.id) throw new Error('Unauthorized');

  assertCanAccessModule(ctx);

  const targetRestaurantId = await resolveTargetRestaurantId(ctx, restaurantId);
  if (!targetRestaurantId) {
    throw new Error('NO_RESTAURANT_CONTEXT: Selecciona un restaurante antes de abrir horarios.');
  }

  await assertRestaurantAccess(ctx, targetRestaurantId);

  const [schedule, employees, zones, templates, config] = await Promise.all([
    getScheduleByWeek(targetRestaurantId, weekStart),
    listEmployees(targetRestaurantId, 'active'),
    listRestaurantZones(targetRestaurantId),
    listShiftTemplates(targetRestaurantId),
    getScheduleConfig(targetRestaurantId),
  ]);

  if (!schedule) {
    throw new Error('SCHEDULE_NOT_FOUND: Crea la semana antes de verla.');
  }

  if (!schedule.published_at) {
    throw new Error('SCHEDULE_NOT_PUBLISHED: Esta semana todavia no tiene una version publicada.');
  }

  const scopedEmployees = filterEmployeesForDraftScope(ctx, employees);
  const scopedZones =
    ctx.profile.is_area_lead && ctx.profile.zone_id
      ? zones.filter((zone) => zone.id === ctx.profile.zone_id)
      : zones;
  const publishedEntries = await getPublishedEntriesForSchedule(schedule);
  const issues = summarizeScheduleIssues({
    config,
    employees: scopedEmployees,
    entries: publishedEntries,
    weekStart,
  });

  return {
    config,
    employees: scopedEmployees,
    issues,
    permissions: buildSchedulePermissions(ctx.profile),
    publication_state: {
      affected_employee_count: 0,
      can_publish: false,
      has_changes: false,
      publication_kind: schedule.published_at ? 'republish' : 'initial',
    },
    schedule: {
      ...schedule,
      schedule_entries: publishedEntries,
      status: 'published',
    },
    shift_templates: templates,
    zones: scopedZones,
  };
}

export async function saveScheduleCellDraftAction(
  scheduleId: string,
  employeeId: string,
  date: string,
  rawValue: string,
): Promise<ScheduleSaveCellResult> {
  const ctx = await getCurrentUserContext();
  if (!ctx || !ctx.profile.id) throw new Error('Unauthorized');

  assertCanManageDraft(ctx);

  const schedule = await loadAuthorizedSchedule(ctx, scheduleId);
  await assertScheduleLockOwnedByUser(schedule.id, ctx.userId);

  const employee = await assertCanEditEmployeeDraft(
    ctx,
    employeeId,
    schedule.restaurant_id,
  );

  return getScheduleDraftService().saveCellDraft({
    actorUserId: ctx.userId,
    date,
    employee: {
      id: employeeId,
      zone_id: employee.zone_id,
    },
    rawValue,
    schedule,
    scopeEmployees: (employees) => filterEmployeesForDraftScope(ctx, employees),
  });
}

export async function upsertScheduleCellAction(
  scheduleId: string,
  employeeId: string,
  date: string,
  updates: Partial<ScheduleEntry>,
) {
  const ctx = await getCurrentUserContext();
  if (!ctx || !ctx.profile.id) throw new Error('Unauthorized');

  assertCanManageDraft(ctx);

  const schedule = await loadAuthorizedSchedule(ctx, scheduleId);
  await assertScheduleLockOwnedByUser(schedule.id, ctx.userId);
  const employee = await assertCanEditEmployeeDraft(
    ctx,
    employeeId,
    schedule.restaurant_id,
  );

  return getScheduleDraftService().upsertCell({
    actorUserId: ctx.userId,
    date,
    employeeId,
    scheduleId,
    updates,
    zoneId: employee.zone_id,
  });
}

export async function updateScheduleCellAction(
  entryId: string,
  version: number,
  updates: Partial<ScheduleEntry>,
) {
  const ctx = await getCurrentUserContext();
  if (!ctx || !ctx.profile.id) throw new Error('Unauthorized');

  assertCanManageDraft(ctx);

  const entry = await loadAuthorizedEntry(ctx, entryId);
  await assertScheduleLockOwnedByUser(entry.schedule_id, ctx.userId);

  return updateEntry(entryId, version, {
    ...updates,
    source: 'manual',
  });
}

export async function loadPublishReviewAction(
  scheduleId: string,
): Promise<SchedulePublishReview> {
  const ctx = await getCurrentUserContext();
  if (!ctx || !ctx.profile.id) throw new Error('Unauthorized');

  assertCanPublish(ctx);

  const schedule = await loadAuthorizedScheduleWithEntries(ctx, scheduleId);
  await assertScheduleLockOwnedByUser(schedule.id, ctx.userId);

  const publicationService = createSchedulePublicationService({
    buildIssueSummaryForSchedule,
    getPublishedEntriesForSchedule,
    listEmployees,
    publishScheduleWeek,
  });

  return publicationService.loadPublishReview({
    schedule,
    scopeEmployees: (employees) => filterEmployeesForDraftScope(ctx, employees),
  });
}

export async function publishScheduleAction(
  scheduleId: string,
  comment?: string,
) {
  const ctx = await getCurrentUserContext();
  if (!ctx || !ctx.profile.id) throw new Error('Unauthorized');

  assertCanPublish(ctx);

  const schedule = await loadAuthorizedScheduleWithEntries(ctx, scheduleId);
  await assertScheduleLockOwnedByUser(schedule.id, ctx.userId);
  const publicationService = createSchedulePublicationService({
    buildIssueSummaryForSchedule,
    getPublishedEntriesForSchedule,
    listEmployees,
    publishScheduleWeek,
  });

  return publicationService.publishSchedule({
    actorUserId: ctx.userId,
    comment,
    schedule,
    scopeEmployees: (employees) => filterEmployeesForDraftScope(ctx, employees),
  });
}

export async function loadEmployeeScheduleWeekAction(
  weekStart: string,
  restaurantId?: string,
): Promise<EmployeeScheduleWeekView> {
  const ctx = await getCurrentUserContext();
  if (!ctx || !ctx.profile.id) throw new Error('Unauthorized');

  assertCanAccessModule(ctx);

  const targetRestaurantId = await resolveTargetRestaurantId(ctx, restaurantId);
  if (!targetRestaurantId) {
    throw new Error('NO_RESTAURANT_CONTEXT: No hay restaurante activo para este horario.');
  }

  await assertRestaurantAccess(ctx, targetRestaurantId);

  const schedule = await getScheduleByWeek(targetRestaurantId, weekStart);
  if (!schedule || schedule.status !== 'published') {
    return buildEmployeeWeekView({
      employeeId: ctx.userId,
      publishedEntries: [],
      schedule,
      weekStart,
    });
  }

  const publishedEntries = await getPublishedEntriesForSchedule(schedule);
  return buildEmployeeWeekView({
    employeeId: ctx.userId,
    publishedEntries,
    schedule,
    weekStart,
  });
}

export async function lockScheduleAction(scheduleId: string) {
  const ctx = await getCurrentUserContext();
  if (!ctx || !ctx.profile.id) throw new Error('Unauthorized');

  assertCanManageDraft(ctx);

  const schedule = await loadAuthorizedSchedule(ctx, scheduleId);
  return getScheduleLockService().acquireOrReuseLock({
    scheduleId: schedule.id,
    userId: ctx.userId,
  });
}

export async function forceUnlockScheduleAction(scheduleId: string) {
  const ctx = await getCurrentUserContext();
  if (!ctx || !ctx.profile.id) throw new Error('Unauthorized');

  assertCanManageDraft(ctx);

  const schedule = await loadAuthorizedSchedule(ctx, scheduleId);
  await getScheduleLockService().forceUnlock({
    actor: {
      id: ctx.profile.id,
      is_area_lead: ctx.profile.is_area_lead,
      role: ctx.profile.role,
      zone_id: ctx.profile.zone_id,
    },
    scheduleId: schedule.id,
  });
}

export async function unlockScheduleAction(scheduleId: string) {
  const ctx = await getCurrentUserContext();
  if (!ctx || !ctx.profile.id) throw new Error('Unauthorized');

  assertCanManageDraft(ctx);

  const schedule = await loadAuthorizedSchedule(ctx, scheduleId);
  await unlockSchedule(schedule.id);
}
