// ── Roles ──
export const ROLES = ['OWNER', 'ADMIN', 'SUPERVISOR', 'AGENT', 'AUDITOR'] as const;
export type Role = (typeof ROLES)[number];

// ── Teams ──
export const TEAMS = ['HH', 'HO'] as const;
export type Team = (typeof TEAMS)[number];

// ── Call Status ──
export const CALL_STATUSES = ['QUEUED', 'IN_PROGRESS', 'COMPLETED', 'TRANSFERRED', 'MISSED'] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

// ── Priority ──
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type Priority = (typeof PRIORITIES)[number];

// ── Patient ──
export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dob?: string;
  phone: string;
  phoneAlt?: string;
  email?: string;
  preferredLanguage: string;
  insuranceProvider?: string;
  insuranceId?: string;
  notes?: string;
  tags: string[];
  active: boolean;
  callCount?: number;
  createdAt: string;
  updatedAt: string;
}

// ── Category ──
export interface Category {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

// ── User ──
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  team: Team;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Call ──
export interface Call {
  id: string;
  callerName: string;
  callerPhone: string;
  categoryId: string;
  categoryName?: string;
  patientId?: string;
  patient?: Patient;
  priority: Priority;
  status: CallStatus;
  team: Team;
  agentId: string;
  agentName?: string;
  notes?: string;
  reason?: string;
  disposition?: string;
  dispositionTemplate?: string;
  followUpDate?: string;
  followUpAssignedTo?: string;
  hipaaAcknowledged: boolean;
  recordingConsent: boolean;
  startedAt?: string;
  completedAt?: string;
  duration?: number; // seconds
  transferredTo?: string;
  transferNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Dashboard ──
export interface DashboardKPIs {
  totalCalls: number;
  activeCalls: number;
  completedCalls: number;
  missedCalls: number;
  avgDuration: number; // seconds
  callsByTeam: Record<string, number>;
  callsByPriority: Record<string, number>;
  callsByCategory: Record<string, number>;
  callsByStatus: Record<string, number>;
  callsByHour: { hour: number; count: number }[];
  topAgents: { agentId: string; agentName: string; count: number; avgDuration: number }[];
}

// ── API Request/Response types ──
export interface CreateCallRequest {
  callerName: string;
  callerPhone: string;
  categoryId: string;
  priority: Priority;
  team: Team;
  notes?: string;
}

export interface TransferCallRequest {
  transferredTo: string;
  transferNotes?: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role: Role;
  team: Team;
}

export interface UpdateUserRequest {
  name?: string;
  role?: Role;
  team?: Team;
  active?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: Omit<User, 'createdAt' | 'updatedAt'>;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// ── RBAC permissions ──
export const ROLE_HIERARCHY: Record<Role, number> = {
  OWNER: 100,
  ADMIN: 80,
  SUPERVISOR: 60,
  AGENT: 20,
  AUDITOR: 40,
};

export function hasMinRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// Role-based permissions
export const PERMISSIONS = {
  'calls:create': ['OWNER', 'ADMIN', 'SUPERVISOR', 'AGENT'] as Role[],
  'calls:read': ['OWNER', 'ADMIN', 'SUPERVISOR', 'AGENT', 'AUDITOR'] as Role[],
  'calls:start': ['OWNER', 'ADMIN', 'SUPERVISOR', 'AGENT'] as Role[],
  'calls:complete': ['OWNER', 'ADMIN', 'SUPERVISOR', 'AGENT'] as Role[],
  'calls:transfer': ['OWNER', 'ADMIN', 'SUPERVISOR', 'AGENT'] as Role[],
  'dashboard:view': ['OWNER', 'ADMIN', 'SUPERVISOR', 'AUDITOR'] as Role[],
  'exports:csv': ['OWNER', 'ADMIN', 'SUPERVISOR', 'AUDITOR'] as Role[],
  'users:manage': ['OWNER', 'ADMIN'] as Role[],
  'categories:manage': ['OWNER', 'ADMIN'] as Role[],
  'admin:view': ['OWNER', 'ADMIN'] as Role[],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSIONS[permission].includes(role);
}
