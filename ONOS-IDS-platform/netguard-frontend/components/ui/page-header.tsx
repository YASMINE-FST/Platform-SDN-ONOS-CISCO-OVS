import type React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Consistent page header used across all dashboard pages.
 * Provides title, optional description and action buttons area.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div>
        <h1 className="text-2xl font-bold text-foreground font-serif">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/** Reusable stat card inside a 3-col grid */
interface StatCardProps {
  label: string;
  value: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'critical' | 'info';
  className?: string;
}

export function StatCard({ label, value, variant = 'default', className }: StatCardProps) {
  const border = {
    default:  'border-border',
    success:  'border-success/30',
    warning:  'border-warning/30',
    critical: 'border-critical/30',
    info:     'border-info/30',
  }[variant];

  const bg = {
    default:  'bg-card',
    success:  'bg-success/5',
    warning:  'bg-warning/5',
    critical: 'bg-critical/5',
    info:     'bg-info/5',
  }[variant];

  const text = {
    default:  'text-muted-foreground',
    success:  'text-success',
    warning:  'text-warning',
    critical: 'text-critical',
    info:     'text-info',
  }[variant];

  return (
    <div className={cn(`rounded-xl border ${border} ${bg} p-4`, className)}>
      <p className={`text-sm ${text}`}>{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

/** Consistent loading skeleton for page content */
export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

/** Empty state placeholder */
export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
      <Icon className="mb-3 h-10 w-10 text-muted-foreground/30" />
      <p className="font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
