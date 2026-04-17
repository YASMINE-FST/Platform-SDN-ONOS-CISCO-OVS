'use client';

import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { LogOut, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function UserMenu() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.replace('/login');
  };

  if (isLoading || !user) return null;

  const initials = user.username?.slice(0, 2).toUpperCase() ?? '??';

  const roleColor =
    user.role === 'admin'
      ? 'bg-cyan-500/20 text-cyan-400'
      : user.role === 'manager'
      ? 'bg-emerald-500/20 text-emerald-400'
      : 'bg-slate-500/20 text-slate-400';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold ring-2 ring-transparent hover:ring-primary/30 transition-all"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-56 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl">
          {/* User info */}
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">{user.username}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <span className={cn('mt-1.5 inline-block rounded-md px-2 py-0.5 text-[10px] font-medium', roleColor)}>
              {user.role}
            </span>
          </div>

          {/* Actions */}
          <div className="p-1">
            {user.role === 'admin' && (
              <button
                onClick={() => { setOpen(false); router.push('/dashboard/users'); }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground/80 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Shield className="h-4 w-4" />
                Administration
              </button>
            )}
            <button
              onClick={() => { setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground/80 hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <User className="h-4 w-4" />
              Profile
            </button>
          </div>

          <div className="border-t border-border p-1">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-critical hover:bg-critical/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
