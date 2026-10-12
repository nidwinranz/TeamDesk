'use client';

import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Org {
  slug: string;
  name: string;
}

export function WorkspaceSwitcher({ current, orgs }: { current: Org; orgs: Org[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
          aria-label={`Switch workspace (current: ${current.name})`}
        >
          <span className="truncate">{current.name}</span>
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {orgs.map((o) => (
          <DropdownMenuItem key={o.slug} asChild>
            <Link href={`/${o.slug}`}>
              <span className="flex-1 truncate">{o.name}</span>
              {o.slug === current.slug && <Check aria-label="current" className="size-4" />}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding">
            <Plus className="size-4" aria-hidden /> New workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
