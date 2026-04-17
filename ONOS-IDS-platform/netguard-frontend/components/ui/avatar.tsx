import { cn } from '@/lib/utils';
import type React from 'react';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ className, size = 'md', ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold',
        size === 'sm' && 'h-7 w-7 text-xs',
        size === 'md' && 'h-9 w-9 text-sm',
        size === 'lg' && 'h-12 w-12 text-base',
        className
      )}
      {...props}
    />
  );
}
