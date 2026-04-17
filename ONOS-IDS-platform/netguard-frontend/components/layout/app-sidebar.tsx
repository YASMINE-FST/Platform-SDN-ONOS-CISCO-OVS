'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  AppWindow,
  Brain,
  FileText,
  GitBranch,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Network,
  Radio,
  Server,
  Settings,
  ShieldAlert,
  Target,
  Terminal,
  Users,
  X,
  BarChart2,
  Wrench,
  Router,
  Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: string[];
  badge?: string;
};

type NavGroup = {
  group: string;
  items: NavItem[];
};

const NAV_ITEMS: NavGroup[] = [
  {
    group: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'viewer'] },
      { href: '/dashboard/topology', label: 'Topology', icon: GitBranch, roles: ['admin', 'manager', 'viewer'] },
      { href: '/dashboard/devices', label: 'Devices', icon: Server, roles: ['admin', 'manager', 'viewer'] },
      { href: '/dashboard/metrics', label: 'Metrics', icon: Activity, roles: ['admin', 'manager', 'viewer'] },
      { href: '/dashboard/onos-apps', label: 'ONOS Apps', icon: AppWindow, roles: ['admin', 'manager'] },
    ],
  },
  {
    group: 'Cisco (CSR)',
    items: [
      { href: '/dashboard/cisco', label: 'Overview', icon: Router, roles: ['admin', 'manager', 'viewer'] },
      { href: '/dashboard/cisco/terminal', label: 'SSH Terminal', icon: Terminal, roles: ['admin', 'manager'] },
      { href: '/dashboard/cisco/interfaces', label: 'Interfaces', icon: Wifi, roles: ['admin', 'manager'] },
      { href: '/dashboard/cisco/routing', label: 'Routing', icon: Network, roles: ['admin', 'manager'] },
      { href: '/dashboard/cisco/config', label: 'Configuration', icon: Settings, roles: ['admin', 'manager'] },
      { href: '/dashboard/cisco/logs', label: 'Logs', icon: Activity, roles: ['admin', 'manager'] },
    ],
  },
  {
    group: 'Open vSwitch',
    items: [
      { href: '/dashboard/ovs', label: 'OVS Config', icon: Wrench, roles: ['admin', 'manager'] },
      { href: '/dashboard/config', label: 'Ports & VLANs', icon: Settings, roles: ['admin', 'manager'] },
      { href: '/dashboard/cli', label: 'CLI / SSH', icon: Terminal, roles: ['admin', 'manager'] },
    ],
  },
  {
    group: 'Security (Beta)',
    items: [
      { href: '/dashboard/alerts', label: 'Alerts', icon: AlertTriangle, roles: ['admin', 'manager', 'viewer'], badge: 'beta' },
      { href: '/dashboard/siem', label: 'SIEM', icon: Activity, roles: ['admin', 'manager', 'viewer'], badge: 'beta' },
      { href: '/dashboard/threat-intel', label: 'Threat Intel', icon: Radio, roles: ['admin', 'manager', 'viewer'], badge: 'beta' },
      { href: '/dashboard/mitre', label: 'MITRE ATT&CK', icon: Target, roles: ['admin', 'manager', 'viewer'], badge: 'beta' },
      { href: '/dashboard/vulnerability', label: 'Vulnerability', icon: ShieldAlert, roles: ['admin', 'manager', 'viewer'], badge: 'beta' },
      { href: '/dashboard/ai-detection', label: 'AI Detection', icon: Brain, roles: ['admin', 'manager', 'viewer'], badge: 'beta' },
      { href: '/dashboard/network-flows', label: 'Network Flows', icon: BarChart2, roles: ['admin', 'manager', 'viewer'], badge: 'beta' },
      { href: '/dashboard/vpls', label: 'VPLS', icon: Network, roles: ['admin', 'manager'], badge: 'beta' },
      { href: '/dashboard/chatbot', label: 'SOC Chatbot', icon: MessageSquare, roles: ['admin', 'manager', 'viewer'], badge: 'beta' },
    ],
  },
  {
    group: 'Admin',
    items: [
      { href: '/dashboard/audit', label: 'Audit Trail', icon: FileText, roles: ['admin', 'manager'] },
      { href: '/dashboard/users', label: 'Users', icon: Users, roles: ['admin'] },
    ],
  },
];

interface AppSidebarProps {
  userRole?: string;
}

export function AppSidebar({ userRole }: AppSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const filteredGroups = NAV_ITEMS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !userRole || item.roles.includes(userRole)
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed bottom-4 left-4 z-40 border border-border bg-background text-foreground shadow-lg lg:hidden"
        onClick={() => setIsOpen((v) => !v)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-16 z-30 flex h-[calc(100vh-64px)] w-56 flex-shrink-0 flex-col',
          'border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
          'transition-transform duration-300',
          'lg:static lg:z-auto lg:h-full lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand accent strip */}
        <div className="flex h-1 w-full flex-shrink-0 overflow-hidden">
          <div className="flex-1 bg-cyan-500" />
          <div className="w-4 bg-emerald-500" />
          <div className="w-4 bg-cyan-400" />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {filteredGroups.map((group) => (
            <div key={group.group} className="mb-5">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {group.group}
              </p>
              <ul className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon, badge }) => {
                  const active =
                    href === '/dashboard'
                      ? pathname === '/dashboard'
                      : pathname === href || pathname.startsWith(`${href}/`);

                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-4 w-4 flex-shrink-0',
                            active ? 'text-cyan-600 dark:text-cyan-400' : 'text-muted-foreground'
                          )}
                        />
                        <span className="flex-1">{label}</span>
                        {badge && (
                          <span
                            className={cn(
                              'rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                              badge === 'beta'
                                ? 'bg-amber-500/15 text-amber-500 dark:text-amber-400'
                                : 'bg-red-500/20 text-red-400'
                            )}
                          >
                            {badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer status */}
        <div className="flex-shrink-0 border-t border-sidebar-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs text-muted-foreground">ONOS Connected</span>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 top-16 z-20 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
