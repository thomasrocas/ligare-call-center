import { describe, it, expect } from 'vitest';

describe('shared package integration', () => {
  it('exports ROLES', async () => {
    const { ROLES } = await import('@ligare/shared');
    expect(ROLES).toContain('OWNER');
    expect(ROLES).toContain('AGENT');
    expect(ROLES).toHaveLength(5);
  });

  it('exports TEAMS', async () => {
    const { TEAMS } = await import('@ligare/shared');
    expect(TEAMS).toContain('HH');
    expect(TEAMS).toContain('HO');
  });

  it('hasPermission works correctly', async () => {
    const { hasPermission } = await import('@ligare/shared');

    // Owner can do everything
    expect(hasPermission('OWNER', 'calls:create')).toBe(true);
    expect(hasPermission('OWNER', 'dashboard:view')).toBe(true);
    expect(hasPermission('OWNER', 'users:manage')).toBe(true);
    expect(hasPermission('OWNER', 'exports:csv')).toBe(true);

    // Agent can manage calls but not dashboard/admin
    expect(hasPermission('AGENT', 'calls:create')).toBe(true);
    expect(hasPermission('AGENT', 'calls:read')).toBe(true);
    expect(hasPermission('AGENT', 'dashboard:view')).toBe(false);
    expect(hasPermission('AGENT', 'users:manage')).toBe(false);
    expect(hasPermission('AGENT', 'exports:csv')).toBe(false);

    // Auditor can read/view but not create
    expect(hasPermission('AUDITOR', 'calls:read')).toBe(true);
    expect(hasPermission('AUDITOR', 'dashboard:view')).toBe(true);
    expect(hasPermission('AUDITOR', 'calls:create')).toBe(false);
    expect(hasPermission('AUDITOR', 'users:manage')).toBe(false);
  });

  it('CALL_STATUSES contains expected values', async () => {
    const { CALL_STATUSES } = await import('@ligare/shared');
    expect(CALL_STATUSES).toContain('QUEUED');
    expect(CALL_STATUSES).toContain('IN_PROGRESS');
    expect(CALL_STATUSES).toContain('COMPLETED');
    expect(CALL_STATUSES).toContain('TRANSFERRED');
    expect(CALL_STATUSES).toContain('MISSED');
  });

  it('PRIORITIES contains expected values', async () => {
    const { PRIORITIES } = await import('@ligare/shared');
    expect(PRIORITIES).toEqual(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
  });

  it('hasMinRole respects hierarchy', async () => {
    const { hasMinRole } = await import('@ligare/shared');
    expect(hasMinRole('OWNER', 'AGENT')).toBe(true);
    expect(hasMinRole('AGENT', 'OWNER')).toBe(false);
    expect(hasMinRole('SUPERVISOR', 'SUPERVISOR')).toBe(true);
  });
});

describe('RBAC permission matrix completeness', () => {
  it('all permissions are defined', async () => {
    const { PERMISSIONS } = await import('@ligare/shared');
    const expectedPermissions = [
      'calls:create', 'calls:read', 'calls:start', 'calls:complete', 'calls:transfer',
      'dashboard:view', 'exports:csv', 'users:manage', 'categories:manage', 'admin:view',
    ];
    expectedPermissions.forEach((p) => {
      expect(PERMISSIONS).toHaveProperty(p);
    });
  });

  it('each permission has at least one role', async () => {
    const { PERMISSIONS } = await import('@ligare/shared');
    Object.entries(PERMISSIONS).forEach(([perm, roles]) => {
      expect(roles.length).toBeGreaterThan(0);
    });
  });
});
