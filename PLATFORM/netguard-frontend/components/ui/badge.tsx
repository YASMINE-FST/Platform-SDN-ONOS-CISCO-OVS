import { cn } from '@/lib/utils';
import type React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'critical' | 'info' | 'outline';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-primary/10 text-primary',
        variant === 'success' && 'bg-success/10 text-success',
        variant === 'warning' && 'bg-warning/10 text-warning',
        variant === 'critical' && 'bg-critical/10 text-critical',
        variant === 'info' && 'bg-info/10 text-info',
        variant === 'outline' && 'border border-border text-foreground',
        className
      )}
      {...props}
    />
  );
}
