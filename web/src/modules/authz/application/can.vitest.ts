import { describe, expect, it } from 'vitest';

import { assertCan, can } from '@/modules/authz';
import type { PersonProfile } from '@/modules/people';

import { buildRequestContextFromProfile } from './requestContext';

function buildProfile(overrides: Partial<PersonProfile> = {}): PersonProfile {
  return {
    avatar_path: null,
    employee_code: 1001,
    full_name: 'Test User',
    id: overrides.id ?? 'user-1',
    is_active: true,
    must_change_password: false,
    restaurant_id: 'restaurant-1',
    role: 'employee',
    zone_id: null,
    ...overrides,
  };
}

describe('authz can', () => {
  it('maps area lead profiles into zone-scoped request contexts', () => {
    const ctx = buildRequestContextFromProfile(
      buildProfile({
        role: 'area_lead',
        zone_id: 'zone-1',
      }),
    );

    expect(ctx.systemRole).toBe('area_lead');
    expect(ctx.scopeType).toBe('zone');
    expect(ctx.responsibilityLevel).toBe(20);
    expect(ctx.personId).toBe('user-1');
    expect(ctx.activeScopes).toEqual([
      { scopeId: 'restaurant-1', scopeType: 'restaurant' },
      { scopeId: 'zone-1', scopeType: 'zone' },
    ]);
    expect(ctx.traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(ctx.now).toBeInstanceOf(Date);
  });

  it('allows restaurant selection only for global roles', () => {
    const admin = buildRequestContextFromProfile(
      buildProfile({
        role: 'admin',
      }),
    );
    const manager = buildRequestContextFromProfile(
      buildProfile({
        role: 'manager',
      }),
    );

    expect(can(admin, 'restaurant_context.select')).toBe(true);
    expect(can(manager, 'restaurant_context.select')).toBe(false);
    expect(admin.activeScopes).toEqual([
      { scopeId: null, scopeType: 'platform' },
      { scopeId: 'restaurant-1', scopeType: 'restaurant' },
    ]);
  });

  it('allows area leads to edit drafts only inside their own zone', () => {
    const areaLead = buildRequestContextFromProfile(
      buildProfile({
        id: 'lead-1',
        role: 'area_lead',
        zone_id: 'zone-1',
      }),
    );

    expect(can(areaLead, 'schedule.edit_draft')).toBe(true);
    expect(
      can(areaLead, 'schedule.edit_employee', {
        targetUserId: 'employee-1',
        targetZoneId: 'zone-1',
      }),
    ).toBe(true);
    expect(
      can(areaLead, 'schedule.edit_employee', {
        targetUserId: 'employee-2',
        targetZoneId: 'zone-2',
      }),
    ).toBe(false);
  });

  it('keeps employees management restricted to global and restaurant roles', () => {
    const areaLead = buildRequestContextFromProfile(
      buildProfile({
        id: 'lead-1',
        role: 'area_lead',
        zone_id: 'zone-1',
      }),
    );
    const manager = buildRequestContextFromProfile(
      buildProfile({
        id: 'manager-1',
        role: 'manager',
      }),
    );

    expect(can(areaLead, 'employees.view')).toBe(false);
    expect(can(manager, 'employees.view')).toBe(true);
    expect(
      can(manager, 'employees.manage_target', {
        targetRestaurantId: 'restaurant-1',
        targetRole: 'employee',
      }),
    ).toBe(true);
    expect(
      can(manager, 'employees.manage_target', {
        targetRestaurantId: 'restaurant-1',
        targetRole: 'manager',
      }),
    ).toBe(false);
  });

  it('rejects schedule draft editing for plain employees', () => {
    const employee = buildRequestContextFromProfile(
      buildProfile({
        id: 'employee-1',
        role: 'employee',
      }),
    );

    expect(() => assertCan(employee, 'schedule.edit_draft')).toThrow(
      /FORBIDDEN/i,
    );
  });
});
