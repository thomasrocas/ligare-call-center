import React from 'react';
import { cn } from '../../lib-utils';

const variants: Record<string, string> = {
  default: 'bg-zinc-100 text-zinc-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
};

interface BadgeProps {
  variant?: keyof typeof variants;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  );
}

// Utility mappings
export function statusBadge(status: string) {
  const map: Record<string, { variant: keyof typeof variants; label: string }> = {
    QUEUED: { variant: 'info', label: 'Queued' },
    IN_PROGRESS: { variant: 'warning', label: 'In Progress' },
    COMPLETED: { variant: 'success', label: 'Completed' },
    TRANSFERRED: { variant: 'purple', label: 'Transferred' },
    MISSED: { variant: 'danger', label: 'Missed' },
  };
  const { variant, label } = map[status] || { variant: 'default', label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

export function priorityBadge(priority: string) {
  const map: Record<string, { variant: keyof typeof variants; label: string }> = {
    LOW: { variant: 'default', label: 'Low' },
    MEDIUM: { variant: 'info', label: 'Medium' },
    HIGH: { variant: 'warning', label: 'High' },
    URGENT: { variant: 'danger', label: 'Urgent' },
  };
  const { variant, label } = map[priority] || { variant: 'default', label: priority };
  return <Badge variant={variant}>{label}</Badge>;
}
