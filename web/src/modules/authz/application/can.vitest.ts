import { describe, expect, it } from 'vitest';

import { assertCan, can } from '@/modules/authz';

import { createRequestContext } from './requestContext';

describe('authz can', () => {
  it('maps area lead actors into zone-scoped request contexts', () => {
    const ctx = createRequestContext({
      personId: 'user-1',
      restaurantId: 'restaurant-1',
      systemRole: 'area_lead',
      zoneId: 'zone-1',
    });

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

  it('allows restaurant selection only for organization-wide roles', () => {
    const admin = createRequestContext({
      personId: 'admin-1',
      systemRole: 'admin',
    });
    const manager = createRequestContext({
      personId: 'manager-1',
      restaurantId: 'restaurant-1',
      systemRole: 'manager',
    });

    expect(can(admin, 'restaurant_context.select')).toBe(true);
    expect(can(manager, 'restaurant_context.select')).toBe(false);
    expect(admin.activeScopes).toEqual([{ scopeId: null, scopeType: 'organization' }]);
  });

  it('allows area leads to edit drafts only inside their own zone', () => {
    const areaLead = createRequestContext({
      personId: 'lead-1',
      restaurantId: 'restaurant-1',
      systemRole: 'area_lead',
      zoneId: 'zone-1',
    });

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
    const areaLead = createRequestContext({
      personId: 'lead-1',
      restaurantId: 'restaurant-1',
      systemRole: 'area_lead',
      zoneId: 'zone-1',
    });
    const manager = createRequestContext({
      personId: 'manager-1',
      restaurantId: 'restaurant-1',
      systemRole: 'manager',
    });

    expect(can(areaLead, 'employees.view')).toBe(false);
    expect(can(manager, 'employees.view')).toBe(true);
    expect(
      can(manager, 'employees.manage_target', {
        targetRestaurantId: 'restaurant-1',
        targetSystemRole: 'employee',
      }),
    ).toBe(true);
    expect(
      can(manager, 'employees.manage_target', {
        targetRestaurantId: 'restaurant-1',
        targetSystemRole: 'manager',
      }),
    ).toBe(false);
  });

  it('rejects schedule draft editing for plain employees', () => {
    const employee = createRequestContext({
      personId: 'employee-1',
      restaurantId: 'restaurant-1',
      systemRole: 'employee',
    });

    expect(() => assertCan(employee, 'schedule.edit_draft')).toThrow(/FORBIDDEN/i);
  });
});
