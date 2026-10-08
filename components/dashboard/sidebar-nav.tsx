'use client';

import {
  BarChart3,
  CreditCard,
  FolderKanban,
  Inbox,
  ScrollText,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ICONS = {
  overview: BarChart3,
  projects: FolderKanban,
  requests: Inbox,
  members: Users,
  billing: CreditCard,
  audit: ScrollText,
  settings: Settings,
} as const;

export interface NavItem {
  key: keyof typeof ICONS;
  label: string;
  href: string;
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Workspace" className="grid gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.key];
        const active =
          item.key === 'overview' ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/60',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
