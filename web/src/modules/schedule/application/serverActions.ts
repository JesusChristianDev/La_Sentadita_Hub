'use server';

import {
  AUDIT_ACTIONS,
  type AuditAction,
  type AuditJsonValue,
  writeAuditLog,
} from '@/modules/audit';
import type { UserContext } from '@/modules/auth_users';
import {
  getCurrentUserContext,
} from '@/modules/auth_users';
import type { EmployeeListItem } from '@/modules/employees';
import { listEmployees } from '@/modules/employees';
import { getRestaurantStatus } from '@/modules/restaurants';
import { assertCan, deriveResponsibilityLevel } from '@/shared/authz';
import { loadEmployeeScopeProjection } from '@/shared/db/employment';

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
  restaurant_id: string | null;
  zone_id: string | null;
};

function isSingleRestaurantActor(ctx: UserContext): boolean {
  return ctx.requestContext.scopeType !== 'organization';
}

async function writeScheduleAuditLog(params: {
  action: AuditAction;
  newValue?: AuditJsonValue;
  previousValue?: AuditJsonValue;
  reason?: string | null;
  restaurantId: string;
  scheduleId: string;
}): Promise<void> {
  const result = await writeAuditLog({
    action: params.action,
    entityId: params.scheduleId,
    entityType: 'schedule',
    newValue: params.newValue,
    previousValue: params.previousValue,
    reason: params.reason,
    scopeId: params.restaurantId,
    scopeType: 'restaurant',
  });

  if (result.status === 'error') {
    console.error('Failed to write schedule audit log', {
      action: params.action,
      error: result.error,
      scheduleId: params.scheduleId,
    });
  }
}

async function writeScheduleEntryAuditLog(params: {
  newValue?: AuditJsonValue;
  previousValue?: AuditJsonValue;
  restaurantId: string;
  scheduleEntryId: string;
}): Promise<void> {
  const result = await writeAuditLog({
    action: AUDIT_ACTIONS.scheduleEntryUpdated,
    entityId: params.scheduleEntryId,
    entityType: 'schedule_entry',
    newValue: params.newValue,
    previousValue: params.previousValue,
    scopeId: params.restaurantId,
    scopeType: 'restaurant',
  });

  if (result.status === 'error') {
    console.error('Failed to write schedule entry audit log', {
      error: result.error,
      scheduleEntryId: params.scheduleEntryId,
    });
  }
}

function assertCanAccessModule(ctx: UserContext): void {
  assertCan(ctx.requestContext, 'schedule.view');
}

function assertCanManageDraft(ctx: UserContext): void {
  assertCan(ctx.requestContext, 'schedule.edit_draft');
}

function assertCanManageTemplates(ctx: UserContext): void {
  assertCan(ctx.requestContext, 'schedule.manage_templates');
}

function assertCanPublish(ctx: UserContext): void {
  assertCan(ctx.requestContext, 'schedule.publish');
}

async function resolveTargetRestaurantId(
  ctx: UserContext,
  restaurantId?: string,
): Promise<string | null> {
  if (restaurantId) return restaurantId;
  return ctx.requestContext.effectiveRestaurantId;
}

async function assertRestaurantAccess(
  ctx: UserContext,
  restaurantId: string,
): Promise<void> {
  assertCanAccessModule(ctx);

  if (
    isSingleRestaurantActor(ctx) &&
    ctx.requestContext.restaurantId &&
    ctx.requestContext.restaurantId !== restaurantId
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
  const employeeScope = await loadEmployeeScopeProjection(employeeId);

  if (!employeeScope) {
    throw new Error('EMPLOYEE_NOT_FOUND: El empleado no existe.');
  }

  const typed = employeeScope as EmployeeScopeRow;
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
  assertCan(ctx.requestContext, 'schedule.edit_employee', {
    targetUserId: employeeId,
    targetZoneId: employee.zone_id,
    zoneId: employee.zone_id,
  });

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
  if (ctx.requestContext.systemRole !== 'area_lead' || !ctx.requestContext.zoneId) {
    return employees;
  }

  return employees.filter(
    (employee) => employee.zone_id === ctx.requestContext.zoneId,
  );
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
    getActorRank: (actor) => deriveResponsibilityLevel(actor.system_role),
    getLockOwnerActor: getScheduleLockOwnerActor,
  });
}

export async function loadScheduleHomeAction(
  restaurantId?: string,
): Promise<ScheduleHomePayload> {
  const ctx = await getCurrentUserContext();
  if (!ctx) throw new Error('Unauthorized');

  const targetRestaurantId = await resolveTargetRestaurantId(ctx, restaurantId);
  const permissions = buildSchedulePermissions(ctx.requestContext);
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
  if (!ctx?.userId) throw new Error('Unauthorized');

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
  if (!ctx?.userId) throw new Error('Unauthorized');

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
    ctx.requestContext.systemRole === 'area_lead' && ctx.requestContext.zoneId
      ? zones.filter((zone) => zone.id === ctx.requestContext.zoneId)
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
    permissions: buildSchedulePermissions(ctx.requestContext),
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
  if (!ctx?.userId) throw new Error('Unauthorized');

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
    ctx.requestContext.systemRole === 'area_lead' && ctx.requestContext.zoneId
      ? zones.filter((zone) => zone.id === ctx.requestContext.zoneId)
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
    permissions: buildSchedulePermissions(ctx.requestContext),
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
  if (!ctx?.userId) throw new Error('Unauthorized');

  assertCanManageDraft(ctx);

  const schedule = await loadAuthorizedSchedule(ctx, scheduleId);
  await assertScheduleLockOwnedByUser(schedule.id, ctx.userId);

  const employee = await assertCanEditEmployeeDraft(
    ctx,
    employeeId,
    schedule.restaurant_id,
  );

  const result = await getScheduleDraftService().saveCellDraft({
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

  await writeScheduleEntryAuditLog({
    newValue: {
      date,
      day_type: result.entry.day_type,
      employee_id: employeeId,
      employment_id: result.entry.employment_id ?? null,
      schedule_id: schedule.id,
      version: result.entry.version,
      zone_id: result.entry.zone_id ?? null,
    },
    restaurantId: schedule.restaurant_id,
    scheduleEntryId: result.entry.id,
  });

  return result;
}

export async function upsertScheduleCellAction(
  scheduleId: string,
  employeeId: string,
  date: string,
  updates: Partial<ScheduleEntry>,
) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.userId) throw new Error('Unauthorized');

  assertCanManageDraft(ctx);

  const schedule = await loadAuthorizedSchedule(ctx, scheduleId);
  await assertScheduleLockOwnedByUser(schedule.id, ctx.userId);
  const employee = await assertCanEditEmployeeDraft(
    ctx,
    employeeId,
    schedule.restaurant_id,
  );

  const result = await getScheduleDraftService().upsertCell({
    actorUserId: ctx.userId,
    date,
    employeeId,
    scheduleId,
    updates,
    zoneId: employee.zone_id,
  });

  await writeScheduleEntryAuditLog({
    newValue: {
      date,
      day_type: result.entry.day_type,
      employee_id: employeeId,
      employment_id: result.entry.employment_id ?? null,
      schedule_id: schedule.id,
      version: result.entry.version,
      zone_id: result.entry.zone_id ?? null,
    },
    restaurantId: schedule.restaurant_id,
    scheduleEntryId: result.entry.id,
  });

  return result;
}

export async function updateScheduleCellAction(
  entryId: string,
  version: number,
  updates: Partial<ScheduleEntry>,
) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.userId) throw new Error('Unauthorized');

  assertCanManageDraft(ctx);

  const entry = await loadAuthorizedEntry(ctx, entryId);
  await assertScheduleLockOwnedByUser(entry.schedule_id, ctx.userId);

  const updatedEntry = await updateEntry(entryId, version, {
    ...updates,
    source: 'manual',
  });

  await writeScheduleEntryAuditLog({
    newValue: {
      day_type: updatedEntry.day_type,
      employment_id: updatedEntry.employment_id ?? null,
      schedule_id: entry.schedule_id,
      version: updatedEntry.version,
      zone_id: updatedEntry.zone_id ?? null,
    },
    previousValue: {
      day_type: entry.day_type,
      employment_id: entry.employment_id ?? null,
      version: entry.version,
      zone_id: entry.zone_id ?? null,
    },
    restaurantId: entry.schedule!.restaurant_id,
    scheduleEntryId: updatedEntry.id,
  });

  return updatedEntry;
}

export async function loadPublishReviewAction(
  scheduleId: string,
): Promise<SchedulePublishReview> {
  const ctx = await getCurrentUserContext();
  if (!ctx?.userId) throw new Error('Unauthorized');

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
  if (!ctx?.userId) throw new Error('Unauthorized');

  assertCanPublish(ctx);

  const schedule = await loadAuthorizedScheduleWithEntries(ctx, scheduleId);
  await assertScheduleLockOwnedByUser(schedule.id, ctx.userId);
  const publicationService = createSchedulePublicationService({
    buildIssueSummaryForSchedule,
    getPublishedEntriesForSchedule,
    listEmployees,
    publishScheduleWeek,
  });

  const publicationKind = schedule.published_at ? 'republish' : 'initial';
  const publishedSchedule = await publicationService.publishSchedule({
    actorUserId: ctx.userId,
    comment,
    schedule,
    scopeEmployees: (employees) => filterEmployeesForDraftScope(ctx, employees),
  });

  await writeScheduleAuditLog({
    action:
      publicationKind === 'republish'
        ? AUDIT_ACTIONS.scheduleRepublished
        : AUDIT_ACTIONS.schedulePublished,
    newValue: {
      comment: comment?.trim() || null,
      publication_kind: publicationKind,
      published_at: publishedSchedule.published_at ?? null,
      week_start: schedule.week_start,
    },
    previousValue: schedule.published_at
      ? {
          published_at: schedule.published_at,
        }
      : undefined,
    reason: comment?.trim() || null,
    restaurantId: schedule.restaurant_id,
    scheduleId: schedule.id,
  });

  return publishedSchedule;
}

export async function loadEmployeeScheduleWeekAction(
  weekStart: string,
  restaurantId?: string,
): Promise<EmployeeScheduleWeekView> {
  const ctx = await getCurrentUserContext();
  if (!ctx?.userId) throw new Error('Unauthorized');

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
  if (!ctx?.userId) throw new Error('Unauthorized');

  assertCanManageDraft(ctx);

  const schedule = await loadAuthorizedSchedule(ctx, scheduleId);
  return getScheduleLockService().acquireOrReuseLock({
    scheduleId: schedule.id,
    userId: ctx.userId,
  });
}

export async function forceUnlockScheduleAction(scheduleId: string) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.userId) throw new Error('Unauthorized');

  assertCanManageDraft(ctx);

  const schedule = await loadAuthorizedSchedule(ctx, scheduleId);
  await getScheduleLockService().forceUnlock({
    actor: {
      id: ctx.person.id,
      system_role: ctx.requestContext.systemRole,
      zone_id: ctx.requestContext.zoneId,
    },
    scheduleId: schedule.id,
  });

  await writeScheduleAuditLog({
    action: AUDIT_ACTIONS.scheduleLockForceReleased,
    newValue: {
      released_by: ctx.userId,
      week_start: schedule.week_start,
    },
    restaurantId: schedule.restaurant_id,
    scheduleId: schedule.id,
  });
}

export async function unlockScheduleAction(scheduleId: string) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.userId) throw new Error('Unauthorized');

  assertCanManageDraft(ctx);

  const schedule = await loadAuthorizedSchedule(ctx, scheduleId);
  await unlockSchedule(ctx.requestContext, schedule.id);
}
