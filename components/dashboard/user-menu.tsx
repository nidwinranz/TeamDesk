import { LogOut } from 'lucide-react';
import { logoutAction } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';

export function UserMenu({
  name,
  email,
  role,
}: {
  name: string | null;
  email: string;
  role: string;
}) {
  return (
    <div className="grid gap-2 border-t pt-4">
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium">{name ?? email}</p>
        <p className="text-muted-foreground truncate text-xs">
          {email} · {role.toLowerCase()}
        </p>
      </div>
      <form action={logoutAction}>
        <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
          <LogOut aria-hidden /> Log out
        </Button>
      </form>
    </div>
  );
}
