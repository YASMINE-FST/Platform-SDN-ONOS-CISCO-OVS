'use client';

import type React from 'react';
import { cn } from '@/lib/utils';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { useAuth } from '@/components/auth-provider';

export function AuthenticatedShell({
  children,
  contentClassName,
}: {
  children: React.ReactNode;
  contentClassName?: string;
}) {
  const { user } = useAuth();

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <AppHeader />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar userRole={user?.role} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className={cn('mx-auto w-full px-4 py-6 sm:px-6 lg:px-8', contentClassName)}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
