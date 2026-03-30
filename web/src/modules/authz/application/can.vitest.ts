import { describe, expect, it } from 'vitest';

import { assertCan, can } from '@/modules/authz';
import type { Profile } from '@/modules/people';

import { buildRequestContextFromProfile } from './requestContext';

function buildProfile(overrides: Partial<Profile> = {}): Profile {
  const role = (overrides.system_role ?? overrides.role ?? 'employee') as Profile['role'];

  return {
    access_status: 'active',
    avatar_path: null,
    employee_code: 1001,
    full_name: 'Test User',
    id: overrides.id ?? 'user-1',
    restaurant_id: 'restaurant-1',
    role,
    system_role: role,
    zone_id: null,
    ...overrides,
  };
}

describe('authz can', () => {
  it('maps area lead profiles into zone-scoped request contexts', () => {
    const ctx = buildRequestContextFromProfile(
      buildProfile({
        role: 'area_lead',
        system_role: 'area_lead',
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
        system_role: 'admin',
      }),
    );
    const manager = buildRequestContextFromProfile(
      buildProfile({
        role: 'manager',
        system_role: 'manager',
      }),
    );

    expect(can(admin, 'restaurant_context.select')).toBe(true);
    expect(can(manager, 'restaurant_context.select')).toBe(false);
    expect(admin.activeScopes).toEqual([
      { scopeId: null, scopeType: 'organization' },
      { scopeId: 'restaurant-1', scopeType: 'restaurant' },
    ]);
  });

  it('allows area leads to edit drafts only inside their own zone', () => {
    const areaLead = buildRequestContextFromProfile(
      buildProfile({
        id: 'lead-1',
        role: 'area_lead',
        system_role: 'area_lead',
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

  it('blocks office from schedules and lets canonical manager roles publish', () => {
    const office = buildRequestContextFromProfile(
      buildProfile({
        id: 'office-1',
        role: 'office',
        system_role: 'office',
        restaurant_id: null,
      }),
    );
    const manager = buildRequestContextFromProfile(
      buildProfile({
        id: 'manager-1',
        role: 'manager',
        system_role: 'manager',
      }),
    );
    const admin = buildRequestContextFromProfile(
      buildProfile({
        id: 'admin-1',
        role: 'admin',
        system_role: 'admin',
        restaurant_id: null,
      }),
    );
    const owner = buildRequestContextFromProfile(
      buildProfile({
        id: 'owner-1',
        role: 'owner',
        system_role: 'owner',
        restaurant_id: null,
      }),
    );

    expect(can(office, 'schedule.view')).toBe(false);
    expect(can(office, 'schedule.edit_draft')).toBe(false);
    expect(can(office, 'schedule.publish')).toBe(false);
    expect(can(manager, 'schedule.publish')).toBe(true);
    expect(can(admin, 'schedule.publish')).toBe(true);
    expect(can(owner, 'schedule.publish')).toBe(true);
  });

  it('treats owner as organization-scoped management', () => {
    const ctx = buildRequestContextFromProfile(
      buildProfile({
        id: 'owner-1',
        role: 'owner',
        system_role: 'owner',
        restaurant_id: null,
      }),
    );

    expect(ctx.scopeType).toBe('organization');
    expect(can(ctx, 'restaurant_context.select')).toBe(true);
    expect(can(ctx, 'schedule.publish')).toBe(true);
  });

  it('keeps employees management restricted to global and restaurant roles', () => {
    const areaLead = buildRequestContextFromProfile(
      buildProfile({
        id: 'lead-1',
        role: 'area_lead',
        system_role: 'area_lead',
        zone_id: 'zone-1',
      }),
    );
    const manager = buildRequestContextFromProfile(
      buildProfile({
        id: 'manager-1',
        role: 'manager',
        system_role: 'manager',
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
        system_role: 'employee',
      }),
    );

    expect(() => assertCan(employee, 'schedule.edit_draft')).toThrow(
      /FORBIDDEN/i,
    );
  });
});
