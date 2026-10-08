import React from 'react';
import { cn } from '../utils/cn.js';

export interface StatusBadgeProps {
  status: string;
  className?: string;
  showDot?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; pulse?: boolean }> = {
  REQUESTED: { label: 'Requested', bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-500', dot: 'bg-amber-500', pulse: true },
  SEARCHING: { label: 'Searching Drivers', bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-500', dot: 'bg-blue-500', pulse: true },
  DRIVER_ASSIGNED: { label: 'Driver Assigned', bg: 'bg-indigo-500/10 border-indigo-500/20', text: 'text-indigo-500', dot: 'bg-indigo-500' },
  DRIVER_ARRIVED: { label: 'Driver Arrived', bg: 'bg-teal-500/10 border-teal-500/20', text: 'text-teal-500', dot: 'bg-teal-500', pulse: true },
  IN_PROGRESS: { label: 'On Trip', bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-500', dot: 'bg-emerald-500', pulse: true },
  COMPLETED: { label: 'Completed', bg: 'bg-green-500/10 border-green-500/20', text: 'text-green-500', dot: 'bg-green-500' },
  CANCELLED_BY_RIDER: { label: 'Cancelled by Rider', bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-500', dot: 'bg-red-500' },
  CANCELLED_BY_DRIVER: { label: 'Cancelled by Driver', bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-500', dot: 'bg-red-500' },
  NO_DRIVERS_FOUND: { label: 'No Drivers Found', bg: 'bg-zinc-500/10 border-zinc-500/20', text: 'text-zinc-400', dot: 'bg-zinc-500' },
  SCHEDULED: { label: 'Scheduled', bg: 'bg-purple-500/10 border-purple-500/20', text: 'text-purple-500', dot: 'bg-purple-500' },
  APPROVED: { label: 'Approved', bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-500', dot: 'bg-emerald-500' },
  PENDING: { label: 'Pending Review', bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-500', dot: 'bg-amber-500' },
  REJECTED: { label: 'Rejected', bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-500', dot: 'bg-red-500' },
  ACTIVE: { label: 'Active', bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-500', dot: 'bg-emerald-500' },
  SUSPENDED: { label: 'Suspended', bg: 'bg-rose-500/10 border-rose-500/20', text: 'text-rose-500', dot: 'bg-rose-500' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className, showDot = true }) => {
  const cfg = STATUS_CONFIG[status] || {
    label: status.replace(/_/g, ' '),
    bg: 'bg-zinc-500/10 border-zinc-500/20',
    text: 'text-zinc-400',
    dot: 'bg-zinc-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors',
        cfg.bg,
        cfg.text,
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            cfg.dot,
            cfg.pulse && 'animate-ping'
          )}
        />
      )}
      {cfg.label}
    </span>
  );
};
